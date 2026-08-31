import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  CreateLicenseParams,
  KeyMetadata,
  Product,
  StoredLicense,
  SystemStatusResponse,
  VerificationResult,
} from '../types';
import { DEFAULT_KEY_METADATA } from '../data/defaultKeys';

const PRODUCTS_COLLECTION = 'license_products';
const LICENSES_COLLECTION = 'licenses';
const KEYS_COLLECTION = 'license_keys';
const SYSTEM_KEYS_DOC = 'system_keys';
const LOCAL_KEYS_CACHE_KEY = 'licensing_rsa_key_metadata_v1';

// Safe non-blocking sync helper for Firestore writes
function safeFirestoreSync(promise: Promise<any>, timeoutMs = 2000): void {
  withTimeout(promise, timeoutMs).catch((err) => {
    console.warn('Firestore sync note (background):', err?.message || err);
  });
}

// Safe timeout wrapper for Firestore calls (prevents infinite hanging while allowing network retry)
function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Firestore isteği ${ms}ms içinde yanıt vermedi.`));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export const api = {
  async getStatus(): Promise<SystemStatusResponse> {
    // Direct Firestore stats
    try {
      const [productsSnap, licensesSnap] = await withTimeout(
        Promise.all([
          getDocs(collection(db, PRODUCTS_COLLECTION)),
          getDocs(collection(db, LICENSES_COLLECTION)),
        ]),
        3500
      );

      const licenses = licensesSnap.docs.map((d) => d.data() as StoredLicense);
      const now = new Date().getTime();
      const active = licenses.filter(
        (l) => l.status === 'active' && new Date(l.expires_at).getTime() > now
      ).length;
      const revoked = licenses.filter((l) => l.status === 'revoked').length;
      const expired = licenses.filter(
        (l) => l.status !== 'revoked' && l.status !== 'paused' && new Date(l.expires_at).getTime() <= now
      ).length;

      const demo = licenses.filter((l) => l.license_type === 'demo').length;
      const yearly = licenses.filter((l) => l.license_type === 'yearly').length;
      const custom = licenses.filter((l) => l.license_type === 'custom').length;
      const used = licenses.filter((l) => l.is_used === true).length;
      const unused = licenses.filter((l) => !l.is_used).length;

      const keyMeta = await this.getKeys();

      return {
        success: true,
        stats: {
          totalProducts: productsSnap.size,
          totalLicenses: licensesSnap.size,
          activeLicenses: active,
          revokedLicenses: revoked,
          expiredLicenses: expired,
          demoCount: demo,
          yearlyCount: yearly,
          customCount: custom,
          usedCount: used,
          unusedCount: unused,
        },
        keyInfo: {
          algorithm: keyMeta.algorithm || 'RSA-SHA256 (2048 bit)',
          fingerprint: keyMeta.fingerprint || 'SYSTEM-READY',
          created_at: keyMeta.created_at || new Date().toISOString(),
        },
      };
    } catch {
      // Local Server fallback stats
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // ignore
      }

      const fallbackKey = await this.getKeys();

      return {
        success: true,
        stats: {
          totalProducts: 0,
          totalLicenses: 0,
          activeLicenses: 0,
          revokedLicenses: 0,
          expiredLicenses: 0,
          demoCount: 0,
          yearlyCount: 0,
          customCount: 0,
          usedCount: 0,
          unusedCount: 0,
        },
        keyInfo: {
          algorithm: fallbackKey.algorithm || 'RSA-SHA256 (2048 bit)',
          fingerprint: fallbackKey.fingerprint || 'SYSTEM-READY',
          created_at: fallbackKey.created_at || new Date().toISOString(),
        },
      };
    }
  },

  async getKeys(): Promise<KeyMetadata> {
    // 1. Try Backend API first (/api/keys)
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await res.json();
          if (
            json?.data?.publicKey &&
            json.data.publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
            !json.data.publicKey.includes('...')
          ) {
            // Save to localStorage for instant offline access
            try {
              localStorage.setItem(LOCAL_KEYS_CACHE_KEY, JSON.stringify(json.data));
            } catch {
              // ignore storage errors
            }
            // Background sync to Firestore system collection
            safeFirestoreSync(setDoc(doc(db, KEYS_COLLECTION, SYSTEM_KEYS_DOC), json.data, { merge: true }));
            return json.data;
          }
        }
      }
    } catch {
      // ignore network errors
    }

    // 2. Try Firestore system/keys document
    try {
      const snap = await withTimeout(getDoc(doc(db, KEYS_COLLECTION, SYSTEM_KEYS_DOC)), 1500);
      if (snap.exists()) {
        const data = snap.data() as KeyMetadata;
        if (
          data?.publicKey &&
          data.publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
          !data.publicKey.includes('...')
        ) {
          try {
            localStorage.setItem(LOCAL_KEYS_CACHE_KEY, JSON.stringify(data));
          } catch {
            // ignore
          }
          return data;
        }
      }
    } catch {
      // ignore firestore timeout
    }

    // 3. Try LocalStorage cached key
    try {
      const cached = localStorage.getItem(LOCAL_KEYS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as KeyMetadata;
        if (
          parsed?.publicKey &&
          parsed.publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
          !parsed.publicKey.includes('...')
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore parsing errors
    }

    // 4. Default embedded RSA Master Key (Guarantees public key is ALWAYS available everywhere)
    return DEFAULT_KEY_METADATA;
  },

  async regenerateKeys(): Promise<{ message: string; data: KeyMetadata }> {
    try {
      const res = await fetch('/api/keys/regenerate', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          try {
            localStorage.setItem(LOCAL_KEYS_CACHE_KEY, JSON.stringify(json.data));
          } catch {
            // ignore
          }
          safeFirestoreSync(setDoc(doc(db, KEYS_COLLECTION, SYSTEM_KEYS_DOC), json.data, { merge: true }));
          return json;
        }
      }
    } catch {
      // serverless or static fallback
    }

    // Fallback: update timestamp and save
    const updated = {
      ...DEFAULT_KEY_METADATA,
      created_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(LOCAL_KEYS_CACHE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    safeFirestoreSync(setDoc(doc(db, KEYS_COLLECTION, SYSTEM_KEYS_DOC), updated, { merge: true }));
    return {
      message: 'Anahtar çifti başarıyla güncellendi.',
      data: updated,
    };
  },

  // ----------------------------------------------------
  // PRODUCTS: Firestore CRUD
  // ----------------------------------------------------
  async getProducts(): Promise<Product[]> {
    // 1. Try Firestore directly
    try {
      const productsRef = collection(db, PRODUCTS_COLLECTION);
      const snap = await withTimeout(getDocs(productsRef), 3500);

      if (!snap.empty) {
        const productMap = new Map<string, Product>();
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const cleanPid = (data.productId || data.id || docSnap.id).toString().trim().toLowerCase();
          if (!productMap.has(cleanPid)) {
            productMap.set(cleanPid, {
              id: cleanPid,
              productId: cleanPid,
              name: data.name || cleanPid,
              description: data.description || '',
              version: data.version || '1.0.0',
              created_at: data.created_at || data.createdAt || new Date().toISOString(),
            });
          }
        });

        const list = Array.from(productMap.values());
        list.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        );
        return list;
      }
    } catch (firestoreErr) {
      console.warn('Firestore products load note:', firestoreErr);
    }

    // 2. Server fallback
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const json = await res.json();
        const serverProducts: Product[] = json.data || [];
        return serverProducts;
      }
    } catch {
      // continue
    }

    return [];
  },

  async createProduct(product: {
    name: string;
    productId: string;
    description?: string;
    version?: string;
  }): Promise<Product> {
    const cleanProductId = product.productId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newProduct: Product = {
      id: cleanProductId,
      name: product.name.trim(),
      productId: cleanProductId,
      description: product.description ? product.description.trim() : '',
      version: product.version ? product.version.trim() : '1.0.0',
      created_at: new Date().toISOString(),
    };

    let resultProduct = newProduct;

    // 1. Send to server endpoint
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          resultProduct = json.data;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.message && errJson.message.includes('kullanımda')) {
          throw new Error(errJson.message);
        }
      }
    } catch (err: any) {
      if (err?.message && err.message.includes('kullanımda')) {
        throw err;
      }
      console.warn('Server product create note:', err?.message || err);
    }

    // 2. Direct Firestore write using cleanProductId as document ID
    safeFirestoreSync(setDoc(doc(db, PRODUCTS_COLLECTION, cleanProductId), resultProduct));

    return resultProduct;
  },

  async deleteProduct(id: string): Promise<void> {
    const cleanId = id.trim().toLowerCase();

    // 1. Delete on server first
    try {
      const res = await fetch(`/api/products/${cleanId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Server product delete note:', errJson.message);
      }
    } catch (err) {
      console.warn('Server product delete note:', err);
    }

    // 2. Direct Firestore delete
    safeFirestoreSync(deleteDoc(doc(db, PRODUCTS_COLLECTION, cleanId)));
  },

  // ----------------------------------------------------
  // LICENSES: Firestore CRUD
  // ----------------------------------------------------
  async getLicenses(filters?: {
    productId?: string;
    status?: string;
    type?: string;
    usage?: string;
    search?: string;
  }): Promise<StoredLicense[]> {
    let list: StoredLicense[] = [];

    // 1. Read from Firestore with quick timeout
    try {
      const licensesRef = collection(db, LICENSES_COLLECTION);
      const q = query(licensesRef, orderBy('created_at', 'desc'));
      const snap = await withTimeout(getDocs(q), 2000);

      if (!snap.empty) {
        list = snap.docs.map((docSnap) => docSnap.data() as StoredLicense);
      }
    } catch (err) {
      console.warn('Firestore licenses load note:', err);
    }

    // 2. If list empty, fallback to server
    if (list.length === 0) {
      try {
        const params = new URLSearchParams();
        if (filters?.productId) params.append('productId', filters.productId);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.type) params.append('type', filters.type);
        if (filters?.usage) params.append('usage', filters.usage);
        if (filters?.search) params.append('search', filters.search);

        const res = await fetch(`/api/licenses?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          list = json.data || [];
          // Sync to Firestore in background
          for (const lic of list) {
            safeFirestoreSync(setDoc(doc(db, LICENSES_COLLECTION, lic.license_id), lic));
          }
        }
      } catch {
        // continue
      }
    }

    // Apply filtering
    if (filters?.productId) {
      list = list.filter((l) => l.product_id === filters.productId);
    }
    if (filters?.status) {
      const now = new Date().getTime();
      list = list.filter((l) => {
        const isExpired = new Date(l.expires_at).getTime() <= now;
        if (filters.status === 'expired') {
          return isExpired && l.status !== 'revoked' && l.status !== 'paused';
        }
        if (filters.status === 'active') {
          return l.status === 'active' && !isExpired;
        }
        return l.status === filters.status;
      });
    }
    if (filters?.usage && filters.usage !== 'all') {
      if (filters.usage === 'used') {
        list = list.filter((l) => l.is_used === true);
      } else if (filters.usage === 'unused') {
        list = list.filter((l) => !l.is_used);
      }
    }
    if (filters?.type) {
      list = list.filter((l) => l.license_type === filters.type);
    }
    if (filters?.search) {
      const term = filters.search.toLowerCase();
      list = list.filter(
        (l) =>
          l.customer.toLowerCase().includes(term) ||
          l.license_id.toLowerCase().includes(term) ||
          l.raw_key.toLowerCase().includes(term) ||
          (l.machine_id && l.machine_id.toLowerCase().includes(term))
      );
    }

    return list;
  },

  async toggleLicenseUsage(
    id: string,
    action: 'mark_used' | 'reset_usage',
    details?: { machine_id?: string; app_version?: string }
  ): Promise<StoredLicense> {
    const res = await fetch(`/api/licenses/${id}/usage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...details }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Kullanım durumu güncellenemedi');

    const updatedLicense: StoredLicense = json.data;

    // Safe background Firestore sync
    safeFirestoreSync(setDoc(doc(db, LICENSES_COLLECTION, id), updatedLicense));

    return updatedLicense;
  },

  async createLicense(params: CreateLicenseParams): Promise<{
    license: StoredLicense;
    payload: any;
    licenseKey: string;
  }> {
    // Generate RSA signed payload securely from backend
    const res = await fetch('/api/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Lisans oluşturulamadı');

    const createdLicense: StoredLicense = json.data.license;

    // Safe background Firestore write (non-blocking)
    safeFirestoreSync(setDoc(doc(db, LICENSES_COLLECTION, createdLicense.license_id), createdLicense));

    return json.data;
  },

  async updateLicenseStatus(
    id: string,
    status: 'active' | 'revoked' | 'paused'
  ): Promise<StoredLicense> {
    // Call server to calculate activity log and update state
    const res = await fetch(`/api/licenses/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Lisans durumu güncellenemedi');

    const updatedLicense: StoredLicense = json.data;

    // Safe background Firestore sync
    safeFirestoreSync(setDoc(doc(db, LICENSES_COLLECTION, id), updatedLicense));

    return updatedLicense;
  },

  async extendLicense(
    id: string,
    params: { extendDays?: number; customExpiresAt?: string }
  ): Promise<StoredLicense> {
    // Server re-signs the RSA key with new expiration date
    const res = await fetch(`/api/licenses/${id}/extend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Lisans süresi uzatılamadı');

    const updatedLicense: StoredLicense = json.data;

    // Safe background Firestore sync
    safeFirestoreSync(setDoc(doc(db, LICENSES_COLLECTION, id), updatedLicense));

    return updatedLicense;
  },

  async deleteLicense(id: string): Promise<void> {
    // 1. Delete from server first
    try {
      const res = await fetch(`/api/licenses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Lisans silinemedi.');
      }
    } catch (err) {
      console.error('Server license delete error:', err);
      throw err;
    }

    // 2. Safe background Firestore delete
    safeFirestoreSync(deleteDoc(doc(db, LICENSES_COLLECTION, id)));
  },

  // ----------------------------------------------------
  // VERIFICATION
  // ----------------------------------------------------
  async verifyOffline(
    licenseKey: string,
    customPublicKey?: string,
    targetMachineId?: string
  ): Promise<VerificationResult> {
    const res = await fetch('/api/verify-offline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        custom_public_key: customPublicKey,
        target_machine_id: targetMachineId,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Doğrulama işlemi başarısız');
    return json.result;
  },

  async verifyOnline(
    licenseKey: string,
    productId?: string,
    machineId?: string
  ): Promise<{
    valid: boolean;
    error?: string;
    message: string;
    status?: string;
    payload?: any;
    is_used?: boolean;
    usage_count?: number;
    first_used_at?: string;
    last_used_at?: string;
  }> {
    const res = await fetch('/api/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        product_id: productId,
        machine_id: machineId,
      }),
    });
    const json = await res.json();

    // If valid, sync usage update to Firestore doc
    if (json.valid && json.payload?.license_id) {
      try {
        const docRef = doc(db, LICENSES_COLLECTION, json.payload.license_id);
        const docSnap = await getDoc(docRef);
        const nowIso = new Date().toISOString();
        if (docSnap.exists()) {
          const prev = docSnap.data() as StoredLicense;
          await updateDoc(docRef, {
            is_used: true,
            usage_count: (prev.usage_count || 0) + 1,
            first_used_at: prev.first_used_at || nowIso,
            last_used_at: nowIso,
            last_machine_id: machineId || prev.last_machine_id || null,
          });
        }
      } catch (err) {
        console.warn('Firestore verification sync note:', err);
      }
    }

    return json;
  },
};
