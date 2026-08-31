// firestoreStore.ts
// Lisansama için Firestore tabanlı veri katmanı.
// server.ts içindeki eski fs.readFileSync/writeFileSync temelli
// getLicenses/saveLicenses/getProducts/saveProducts/initializeKeys/
// getPrivateKeyPem/getPublicKeyPem/getKeyMetadata fonksiyonlarının
// YERİNE geçer. Tüm fonksiyonlar artık ASYNC (Promise döner).

import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

// ---------------------------------------------------------------
// Firebase Admin başlatma
// ---------------------------------------------------------------
// Vercel proje ayarlarında FIREBASE_SERVICE_ACCOUNT_JSON adında bir
// environment variable oluştur; değeri Firebase Console >
// Project Settings > Service Accounts > "Generate new private key"
// ile indirdiğin JSON dosyasının TAMAMI (tek satır, escape edilmiş) olmalı.
const apps = (admin as any).apps || (admin as any).getApps?.() || [];
if (!apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: (admin as any).credential.cert(serviceAccount),
      });
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT_JSON parse hatası:", e);
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "project-2f92977a-3f04-4243-aee",
      });
    }
  } else {
    // Local dev fallback if variable is not set yet in local environment
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "project-2f92977a-3f04-4243-aee",
    });
  }
}

const databaseId = process.env.FIREBASE_DATABASE_ID || "lisanslamaaaa";
const db = getFirestore(databaseId);

// ---------------------------------------------------------------
// Ortak tipler (server.ts'teki tiplerle aynı olmalı)
// ---------------------------------------------------------------
export interface StoredKeyConfig {
  algorithm: string;
  keySize: number;
  created_at: string;
  fingerprint: string;
  publicKey: string;
  encryptedPrivateKey: {
    encrypted: string;
    iv: string;
    tag: string;
    salt: string;
  };
}

export interface Product {
  id: string;
  name: string;
  productId: string;
  description: string;
  version: string;
  created_at: string;
}

export interface LicenseActivityLog {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  details?: Record<string, any>;
}

export interface StoredLicense {
  license_id: string;
  product_id: string;
  product_name?: string;
  license_type: "demo" | "yearly" | "custom";
  customer: string;
  issued_at: string;
  expires_at: string;
  machine_id: string | null;
  status: "active" | "revoked" | "paused";
  raw_key: string;
  created_at: string;
  revoked_at?: string | null;
  paused_at?: string | null;
  notes?: string;
  extra?: Record<string, unknown>;
  logs?: LicenseActivityLog[];
  is_used?: boolean;
  first_used_at?: string | null;
  last_used_at?: string | null;
  usage_count?: number;
  last_machine_id?: string | null;
  app_version?: string | null;
}

// ---------------------------------------------------------------
// AES-256-GCM şifreleme yardımcıları (server.ts'tekiyle birebir aynı,
// mevcut şifreli private key'lerle uyumluluk için değiştirilmedi)
// ---------------------------------------------------------------
const MASTER_SECRET =
  process.env.LICENSE_MASTER_SECRET ||
  "lisans-sistemi-guvenli-anahtar-2026-secret-passphrase";

function encryptPrivateKey(privateKeyPem: string, secret: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(privateKeyPem, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return {
    encrypted,
    iv: iv.toString("hex"),
    tag,
    salt: salt.toString("hex"),
  };
}

function decryptPrivateKey(
  data: { encrypted: string; iv: string; tag: string; salt: string },
  secret: string
): string {
  const salt = Buffer.from(data.salt, "hex");
  const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256");
  const iv = Buffer.from(data.iv, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(Buffer.from(data.tag, "hex"));
  let decrypted = decipher.update(data.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function getFingerprint(publicKeyPem: string): string {
  const cleaned = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(cleaned, "base64"))
    .digest("hex");
  return hash.match(/.{1,2}/g)?.join(":").toUpperCase() || hash;
}

// ---------------------------------------------------------------
// KEYS  ->  Firestore: license_keys/main
// ---------------------------------------------------------------
const KEYS_DOC = db.collection("license_keys").doc("main");

export async function initializeKeys(
  forceNew = false
): Promise<{ publicKey: string; fingerprint: string; created_at: string }> {
  if (!forceNew) {
    const snap = await KEYS_DOC.get();
    if (snap.exists) {
      const content = snap.data() as StoredKeyConfig;
      return {
        publicKey: content.publicKey,
        fingerprint: content.fingerprint,
        created_at: content.created_at,
      };
    }
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const encryptedPrivateKey = encryptPrivateKey(privateKey, MASTER_SECRET);
  const created_at = new Date().toISOString();
  const fingerprint = getFingerprint(publicKey);

  const keyConfig: StoredKeyConfig = {
    algorithm: "RSA-SHA256 (2048 bit)",
    keySize: 2048,
    created_at,
    fingerprint,
    publicKey,
    encryptedPrivateKey,
  };

  await KEYS_DOC.set(keyConfig);
  return { publicKey, fingerprint, created_at };
}

export async function getPrivateKeyPem(): Promise<string> {
  const snap = await KEYS_DOC.get();
  if (!snap.exists) {
    await initializeKeys();
    return getPrivateKeyPem();
  }
  const content = snap.data() as StoredKeyConfig;
  return decryptPrivateKey(content.encryptedPrivateKey, MASTER_SECRET);
}

export async function getPublicKeyPem(): Promise<string> {
  const snap = await KEYS_DOC.get();
  if (!snap.exists) {
    return (await initializeKeys()).publicKey;
  }
  return (snap.data() as StoredKeyConfig).publicKey;
}

export async function getKeyMetadata() {
  const snap = await KEYS_DOC.get();
  if (!snap.exists) {
    await initializeKeys();
    return getKeyMetadata();
  }
  const content = snap.data() as StoredKeyConfig;
  return {
    algorithm: content.algorithm || "RSA-SHA256 (2048 bit)",
    keySize: content.keySize || 2048,
    created_at: content.created_at,
    fingerprint: content.fingerprint,
    publicKey: content.publicKey,
  };
}

// ---------------------------------------------------------------
// PRODUCTS  ->  Firestore: license_products/{productId}
// ---------------------------------------------------------------
const PRODUCTS_COL = db.collection("license_products");

export async function getProducts(): Promise<Product[]> {
  const snap = await PRODUCTS_COL.get();
  if (snap.empty) {
    const defaultProducts: Product[] = [
      {
        id: "prod-1",
        name: "Akıllı Muhasebe ve ERP Sistemi",
        productId: "akilli-muhasebe-erp",
        description: "Masaüstü ve web tabanlı kurumsal muhasebe çözümü",
        version: "3.2.0",
        created_at: new Date().toISOString(),
      },
      {
        id: "prod-2",
        name: "E-Ticaret Sipariş & Stok Entegratörü",
        productId: "eticaret-entegrator",
        description: "Pazaryeri ve depo otomasyonu yazılımı",
        version: "2.1.0",
        created_at: new Date().toISOString(),
      },
      {
        id: "prod-3",
        name: "Mobil Saha Satış & Raporlama",
        productId: "saha-satis-mobil",
        description: "Saha temsilcileri ve B2B sipariş yönetim aracı",
        version: "1.5.4",
        created_at: new Date().toISOString(),
      },
    ];
    await saveProducts(defaultProducts);
    return defaultProducts;
  }
  return snap.docs.map((d) => d.data() as Product);
}

export async function saveProducts(products: Product[]): Promise<void> {
  const batch = db.batch();
  products.forEach((p) => {
    batch.set(PRODUCTS_COL.doc(p.productId), p);
  });
  await batch.commit();
}

// ---------------------------------------------------------------
// LICENSES  ->  Firestore: licenses/{license_id}
// ---------------------------------------------------------------
const LICENSES_COL = db.collection("licenses");

export async function getLicenses(): Promise<StoredLicense[]> {
  const snap = await LICENSES_COL.get();
  const licenses = snap.docs.map((d) => d.data() as StoredLicense);

  // Eski kayıtlarda log yoksa doldur (bir kereye mahsus, mevcut davranışla aynı)
  let modified = false;
  licenses.forEach((lic) => {
    if (!lic.logs || !Array.isArray(lic.logs) || lic.logs.length === 0) {
      lic.logs = [
        {
          id: "log-init-" + lic.license_id.slice(0, 8),
          timestamp: lic.created_at || lic.issued_at || new Date().toISOString(),
          action: "created",
          description: `Lisans "${lic.customer}" için oluşturuldu.`,
          details: {
            issued_at: lic.issued_at,
            expires_at: lic.expires_at,
            product_id: lic.product_id,
          },
        },
      ];
      modified = true;
    }
  });
  if (modified) {
    await saveLicenses(licenses);
  }
  return licenses;
}

export async function saveLicenses(licenses: StoredLicense[]): Promise<void> {
  // Firestore batch işlemleri en fazla 500 doküman destekler; lisans sayın
  // 500'ü geçerse chunk'lara bölünür.
  const chunkSize = 450;
  for (let i = 0; i < licenses.length; i += chunkSize) {
    const chunk = licenses.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach((lic) => {
      batch.set(LICENSES_COL.doc(lic.license_id), lic);
    });
    await batch.commit();
  }
}
