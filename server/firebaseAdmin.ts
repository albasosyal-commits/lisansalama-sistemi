import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  Firestore,
} from "firebase/firestore";
import crypto from "crypto";
import path from "path";

// ----------------------------------------------------
// Master Key Encryption Helpers (AES-256-GCM)
// ----------------------------------------------------
const MASTER_SECRET =
  process.env.LICENSE_MASTER_SECRET ||
  "lisans-sistemi-guvenli-anahtar-2026-secret-passphrase";

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
  licenseCount?: number;
  activeLicenseCount?: number;
}

export interface LicenseActivityLog {
  id: string;
  timestamp: string;
  action:
    | 'created'
    | 'extended'
    | 'paused'
    | 'unpaused'
    | 'revoked'
    | 'reactivated'
    | 'activated'
    | 'used'
    | 'reset_usage';
  description: string;
  details?: Record<string, any>;
}

export interface LicensePayload {
  license_id: string;
  product_id: string;
  license_type: "demo" | "yearly" | "custom";
  customer: string;
  issued_at: string;
  expires_at: string;
  machine_id: string | null;
  extra?: Record<string, unknown>;
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

// AES-256-GCM Encryption
export function encryptPrivateKey(
  privateKeyPem: string,
  secret: string
): { encrypted: string; iv: string; tag: string; salt: string } {
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

// AES-256-GCM Decryption
export function decryptPrivateKey(
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

export function getFingerprint(publicKeyPem: string): string {
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

// Sanitize objects for Firestore (removes undefined values)
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitizeForFirestore(value);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

// ----------------------------------------------------
// Default Master Key Pair & Seed Data
// ----------------------------------------------------
const DEFAULT_KEY_CONFIG: StoredKeyConfig = {
  algorithm: "RSA-SHA256 (2048 bit)",
  keySize: 2048,
  created_at: "2026-08-29T23:29:47.541Z",
  fingerprint:
    "9D:F0:99:B9:51:D5:2E:9D:76:4D:A5:6E:F5:74:58:E3:71:45:2D:97:33:7F:14:2D:A1:52:58:E4:81:40:CE:F4",
  publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7u+PFFQPYcTRo958o6P9
rX3c8XKpnFOqUpdmF0PALvh47WairqVbL4cR3YcyA7nNCNlU0o1A70pZ25MOCk90
uxSoU9yi01XGLcxLwtqVFWQO59PPkGM2Ih+w/e+oYlo/HjslNbN3ULXaVWEzhoIl
zpqc630YqcsA+XzxH5zgIkvUMLdKFBPSHM3d+yxDxMAuIQA575aQxW8hrQ/niNTM
5i5pJJWEefK5jBiycqAQTH6dbTDy3sdUcZ8H13C3FOLqG1yqrGIAREjeWX42aDI2
A8GdONJVcrtRAVvvWKuTyOZ5bWqNjmlwB5MnVhiC/W+4boPkZhf7XyQkyy/Qmget
sQIDAQAB
-----END PUBLIC KEY-----`,
  encryptedPrivateKey: {
    encrypted:
      "ebc4ab7cfd7e030770f321f3c8de3c46b0e3c6cc0bc1753430556bdf4545dbb9a5e929f83e1c1dbcc504c9b5b359ffb13ce09146ba865becc98c6fc5b89d4093ffc371267e4c87e37dcc19ded8be9e1abbe5a8dbe4c83fc1140037855be8abc728175212f61896d3c406bb8187bf8c5079dc25b19682fe1b3a044bb82f876d1b97adf53d1a2d011cf503ca41d3638fcca16e647b56ccddca50a10a0d7d85629930e96902cf86cfab60f676f7ba6ae0dedbee427689536a252639fb41631c425e5f2bcbc36347ab73c9ad4432d2d8aa7f09c23cc1ae1dfd3ba7fef76c1843bf630e5f0af5ee140d11a20743b30c28e303aef9ebc42b03cc01555c3439de48e4af2b594ec93982ff88af46d5026b537165e5e238935ba930bef144522d0812755e342517d30f93761b39adcc0b88b72b09034324f945b1b1aac97a1548d464972ed526da5dd4e19de4cf01ebdbc78466ece5c878cfeac9478768ff90b07cba13f3632fc510f97098dbf008c9564dd13f354331d426d8c85fdc4db02fdf2f0d4c47ebc402d131caa163fa3498ac762941e056369adb6a47e29070aa9b822b0e6469e1370777820e4bebf7230fee132daf87758c6f51d6a96d14a1a0d1c6f33f84e879d77583656d9224a53722a07c7a59ec503afa6bd022103b36e96a8ceb989881d4774e0f2f65b970a59a1bad4bec14a0b91139f72a3eea522585315626f3e9e346b08418e09b98e7296d4e99ac6e8fe949a36ebe255cdebb9ef9806a6a4ccd306d71bdacc26593bc8ba56ae72156349143fc3b5f2c99dde5326c10adff48636c3310b69ad41aadbcf44f37618019facd0250d9379f48b8f9a310066ac6052ac89b7aa0350366eda44e2f4b935c824f3522021a1bf8a3cc0cb40e15c40aaa475e4d357896ee6889a078e001508b9606fbd904faa7c2aae2de44840bddc08b0a725fcc3fe10f20aaa306e5c03dde795817b32a3c452656556a9ef2cc00e0ac7436f4db804e5a4a8e7c2fed79cb540aafc125ab777d6057955644b10ef0cdd332084dbb4623d9f19ebbeb463c26c4bd3bd42f78b767d4e066bb2b3e366a15181ac25a2eab5320e73c71eb580999e87fc5f97408aa7b6cd6740a11aec6efab407878909e645b0fe6b54b285b817af857477e893c656bafc2e92e42c6ee483a6d22288e9b69aa08251c24b31239ded2782ab6e8a2e993643cc668ddd2abaf40a6145b6431f8e32fadaa797425c9692f1f1cb057f29347f82f556bcdc725c43396ee38ec3b40a12fe6f94eb4345c0c68e38e23b5608e438b49d0233b18010c1ddac8f0eb7b45fb6da133bb39b423ab7de3eacea7a41ace533b37c2f298fd197832fe7a615c298d7faaa0722213ef19d5dbda6fe678a14c825e7aa8ad9b660435e7ddb01d8b2bf33c3d01d1fb93b97d5bd37334da55d52fc26e4a0efa8a705125d43cb40e7a6b31b6fc95eb4a7749e2c5d17a349d78ff42e5017d37401ff69cd1f5d0f6f466bbd53d0366ce3109181ea3131012f52aec67356e327f1665d5f8a78a79471449983fe4a401e3fb9375a79c6bace6d9ae71c751fb67501d56d375900d1e31c39ef9c9803bb0489488000e5eeed15786a68ef03f82c7b48932ffe49e1941afd55ad420e57f30d0db9aac484b5fc322fbb4b0ba871104742ffbdd9efe6ebe03188bfea02e5794942e47621d5e703a852906572022ecfae0d95e5009f4e82e7e5db5ec571f585106982db1c33762fcf51160b945edb5842ed92e95c6305396ebf8adec1430377f95a1639420d17d3eaa7cf17dcb2c6607dc7538bcdcc36c8e9ca9750439e502cac3bb24031288717e623340c5d20542b7b93c20f7780971f34613226e2f17442597127a7ea20fd53f1673169d2b7308588b5b34b6726a9cf6c68b56607783222df7754d6091c58ad93e85712d909cb342abf9ee20fcd588a6cf11aa2d04b9f06e7095031246586ec561d30c578dcd042a8dea242f991d5aa19e15c4d61c126251dc674dc9415abb946c36a6139ad9d842b98a99d725f3317e189a4535eb0c0fc22ec96861b1e3cfecdc14dabbb67f030ff48674a155de0bd6b8cbdca386a13fc6bb9719b7933faa7f1cc673ce65eafc75aa6bd97a63debb7d5166cb4b3335900ad04234481fd495adeda0fa036332522290f73e62f3c496865abbb5ca89de59bea9e47a7ba8937481d16b4fc6009cabd9f9d4a151457e3f783001614831ee8b7c31870b288eb5bc77b9aa07795a0f4f7af4005131b45ed767db353aa16442a8c4850aab9e11ed54a3609e50b6a4824dd841e38171398a3a3201cddab4b20a6d0233fef30d9bf2b26b42aee71f08547fbab1ec73a644b311b62d899ac1159c413798f3ed6151002422b77cc9ab3aa342ab7cda4e7fb742bc2d9488f0111e505ad1df",
    iv: "24ca3f60f7ee9f67db145dee",
    tag: "4869d169d2f2fe799da24b608915846c",
    salt: "a1602cdc69258d29f74b2f33bd4b1083",
  },
};

// ----------------------------------------------------
// Firestore Collections Specification
// ----------------------------------------------------
export const COLLECTIONS = {
  KEYS: "license_keys",
  PRODUCTS: "license_products",
  LICENSES: "licenses",
};

export const SYSTEM_KEY_DOC_ID = "system_keys";

// ----------------------------------------------------
// Firebase Initializer
// ----------------------------------------------------
let dbInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (dbInstance) return dbInstance;

  const firebaseConfig = {
    projectId:
      process.env.FIREBASE_PROJECT_ID || "project-2f92977a-3f04-4243-aee",
    appId:
      process.env.FIREBASE_APP_ID || "1:442102724532:web:c34620e3d8ec71a2cfa4e1",
    apiKey:
      process.env.FIREBASE_API_KEY || "AIzaSyBkVyJGHQmlKf-jjL6Q-MefI92pSTEOL0E",
    authDomain:
      process.env.FIREBASE_AUTH_DOMAIN ||
      "project-2f92977a-3f04-4243-aee.firebaseapp.com",
  };

  const databaseId =
    process.env.FIREBASE_DATABASE_ID || "lisanslamaaaa";

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  dbInstance = getFirestore(app, databaseId);
  return dbInstance;
}

// ----------------------------------------------------
// In-Memory Fast Cache / Fallback
// ----------------------------------------------------
let cachedKeyConfig: StoredKeyConfig | null = null;
let cachedProducts: Product[] | null = null;
let cachedLicenses: StoredLicense[] | null = null;

// ----------------------------------------------------
// 1. Key Management Repository
// ----------------------------------------------------
export async function getStoredKeyConfig(): Promise<StoredKeyConfig> {
  if (cachedKeyConfig) return cachedKeyConfig;

  try {
    const db = getFirestoreDb();
    const docRef = doc(db, COLLECTIONS.KEYS, SYSTEM_KEY_DOC_ID);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as StoredKeyConfig;
      if (data?.publicKey && data?.encryptedPrivateKey) {
        cachedKeyConfig = data;
        return data;
      }
    }

    // Seed default master key into Firestore
    await setDoc(docRef, sanitizeForFirestore(DEFAULT_KEY_CONFIG), { merge: true });
    cachedKeyConfig = DEFAULT_KEY_CONFIG;
    return DEFAULT_KEY_CONFIG;
  } catch (err) {
    console.warn("Firestore getStoredKeyConfig fallback to default:", err);
    cachedKeyConfig = DEFAULT_KEY_CONFIG;
    return DEFAULT_KEY_CONFIG;
  }
}

export async function saveStoredKeyConfig(config: StoredKeyConfig): Promise<void> {
  cachedKeyConfig = config;
  try {
    const db = getFirestoreDb();
    const docRef = doc(db, COLLECTIONS.KEYS, SYSTEM_KEY_DOC_ID);
    await setDoc(docRef, sanitizeForFirestore(config), { merge: true });
  } catch (err) {
    console.error("Error saving key config to Firestore:", err);
  }
}

export async function getPrivateKeyPem(): Promise<string> {
  const config = await getStoredKeyConfig();
  return decryptPrivateKey(config.encryptedPrivateKey, MASTER_SECRET);
}

export async function getPublicKeyPem(): Promise<string> {
  const config = await getStoredKeyConfig();
  return config.publicKey;
}

export async function getKeyMetadata() {
  const config = await getStoredKeyConfig();
  return {
    algorithm: config.algorithm || "RSA-SHA256 (2048 bit)",
    keySize: config.keySize || 2048,
    created_at: config.created_at,
    fingerprint: config.fingerprint,
    publicKey: config.publicKey,
  };
}

export async function regenerateKeyPair(): Promise<StoredKeyConfig> {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  const encryptedPrivateKey = encryptPrivateKey(privateKey, MASTER_SECRET);
  const created_at = new Date().toISOString();
  const fingerprint = getFingerprint(publicKey);

  const newKeyConfig: StoredKeyConfig = {
    algorithm: "RSA-SHA256 (2048 bit)",
    keySize: 2048,
    created_at,
    fingerprint,
    publicKey,
    encryptedPrivateKey,
  };

  await saveStoredKeyConfig(newKeyConfig);
  return newKeyConfig;
}

// ----------------------------------------------------
// 2. Product Management Repository
// ----------------------------------------------------
export async function getProducts(): Promise<Product[]> {
  try {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTIONS.PRODUCTS));

    if (snap.empty) {
      cachedProducts = [];
      return [];
    }

    const list: Product[] = [];
    snap.forEach((d) => {
      const data = d.data() as Product;
      list.push({
        ...data,
        id: data.id || data.productId || d.id,
        productId: data.productId || data.id || d.id,
      });
    });

    list.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
    cachedProducts = list;
    return list;
  } catch (err) {
    console.warn("Firestore getProducts fallback:", err);
    return cachedProducts || [];
  }
}

export async function saveProduct(product: Product): Promise<void> {
  const db = getFirestoreDb();
  const cleanProductId = product.productId.trim().toLowerCase();
  const cleanProduct: Product = {
    ...product,
    id: cleanProductId,
    productId: cleanProductId,
  };

  const docRef = doc(db, COLLECTIONS.PRODUCTS, cleanProductId);
  await setDoc(docRef, sanitizeForFirestore(cleanProduct), { merge: true });

  if (cachedProducts) {
    const idx = cachedProducts.findIndex((p) => p.productId === cleanProductId || p.id === cleanProductId);
    if (idx >= 0) {
      cachedProducts[idx] = cleanProduct;
    } else {
      cachedProducts.unshift(cleanProduct);
    }
  }
}

export async function deleteProduct(productIdOrId: string): Promise<void> {
  const db = getFirestoreDb();
  const cleanId = productIdOrId.trim().toLowerCase();
  
  // Try deleting document by ID
  await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, cleanId));

  if (cachedProducts) {
    cachedProducts = cachedProducts.filter((p) => p.productId !== cleanId && p.id !== cleanId);
  }
}

// ----------------------------------------------------
// 3. Licenses Management Repository
// ----------------------------------------------------
export async function getLicenses(): Promise<StoredLicense[]> {
  try {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, COLLECTIONS.LICENSES));

    const list: StoredLicense[] = [];
    snap.forEach((d) => {
      const lic = d.data() as StoredLicense;
      list.push(lic);
    });

    list.sort(
      (a, b) =>
        new Date(b.created_at || b.issued_at || 0).getTime() -
        new Date(a.created_at || a.issued_at || 0).getTime()
    );
    cachedLicenses = list;
    return list;
  } catch (err) {
    console.warn("Firestore getLicenses fallback:", err);
    return cachedLicenses || [];
  }
}

export async function getLicenseById(licenseId: string): Promise<StoredLicense | null> {
  try {
    const db = getFirestoreDb();
    const docRef = doc(db, COLLECTIONS.LICENSES, licenseId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as StoredLicense;
    }
  } catch (err) {
    console.warn("Firestore getLicenseById error:", err);
  }

  if (cachedLicenses) {
    return cachedLicenses.find((l) => l.license_id === licenseId) || null;
  }
  return null;
}

export async function saveLicense(license: StoredLicense): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.LICENSES, license.license_id);
  await setDoc(docRef, sanitizeForFirestore(license), { merge: true });

  if (cachedLicenses) {
    const idx = cachedLicenses.findIndex((l) => l.license_id === license.license_id);
    if (idx >= 0) {
      cachedLicenses[idx] = license;
    } else {
      cachedLicenses.unshift(license);
    }
  }
}

export async function deleteLicense(licenseId: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTIONS.LICENSES, licenseId));

  if (cachedLicenses) {
    cachedLicenses = cachedLicenses.filter((l) => l.license_id !== licenseId);
  }
}

// ----------------------------------------------------
// 4. Activity Logs Helper
// ----------------------------------------------------
export function addLicenseLog(
  license: StoredLicense,
  action:
    | 'created'
    | 'extended'
    | 'paused'
    | 'unpaused'
    | 'revoked'
    | 'reactivated'
    | 'activated'
    | 'used'
    | 'reset_usage',
  description: string,
  details?: Record<string, any>
) {
  if (!license.logs) {
    license.logs = [];
  }
  license.logs.unshift({
    id: "log-" + crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    description,
    details,
  });
}

// ----------------------------------------------------
// 5. Cryptographic Signing & Verification Helpers
// ----------------------------------------------------
export async function signLicensePayload(payload: LicensePayload): Promise<string> {
  const privateKeyPem = await getPrivateKeyPem();
  const payloadString = JSON.stringify(payload);

  const sign = crypto.createSign("SHA256");
  sign.update(payloadString);
  sign.end();

  const signatureBuffer = sign.sign(privateKeyPem);

  const payloadBase64 = Buffer.from(payloadString, "utf8").toString("base64");
  const signatureBase64 = signatureBuffer.toString("base64");

  return `${payloadBase64}.${signatureBase64}`;
}

export async function verifyLicenseKeyString(
  licenseKey: string,
  customPublicKeyPem?: string
): Promise<{
  valid: boolean;
  tampered: boolean;
  expired: boolean;
  message: string;
  payload: LicensePayload | null;
}> {
  try {
    if (!licenseKey || !licenseKey.includes(".")) {
      return {
        valid: false,
        tampered: true,
        expired: false,
        message: "Geçersiz lisans formatı (Nokta ile ayrılmış Base64 payload ve imza gereklidir).",
        payload: null,
      };
    }

    const parts = licenseKey.trim().split(".");
    if (parts.length !== 2) {
      return {
        valid: false,
        tampered: true,
        expired: false,
        message: "Lisans anahtarı 2 parçadan (Payload + İmza) oluşmalıdır.",
        payload: null,
      };
    }

    const [payloadBase64, signatureBase64] = parts;
    const payloadString = Buffer.from(payloadBase64, "base64").toString("utf8");
    const signatureBuffer = Buffer.from(signatureBase64, "base64");

    let parsedPayload: LicensePayload;
    try {
      parsedPayload = JSON.parse(payloadString);
    } catch {
      return {
        valid: false,
        tampered: true,
        expired: false,
        message: "Lisans payload'u geçerli bir JSON verisi değil.",
        payload: null,
      };
    }

    const publicKeyToUse = customPublicKeyPem || (await getPublicKeyPem());

    const verify = crypto.createVerify("SHA256");
    verify.update(payloadString);
    verify.end();

    const isSignatureValid = verify.verify(publicKeyToUse, signatureBuffer);

    if (!isSignatureValid) {
      return {
        valid: false,
        tampered: true,
        expired: false,
        message:
          "Dijital imza doğrulanmadı! Lisans anahtarı değiştirilmiş, bozulmuş veya farklı bir anahtarla imzalanmış.",
        payload: parsedPayload,
      };
    }

    // Check expiration date
    const now = new Date();
    const expiresAt = new Date(parsedPayload.expires_at);

    if (now.getTime() > expiresAt.getTime()) {
      return {
        valid: false,
        tampered: false,
        expired: true,
        message: `Lisans süresi dolmuş (${expiresAt.toISOString()}). İmza geçerli fakat kullanım süresi sona erdi.`,
        payload: parsedPayload,
      };
    }

    return {
      valid: true,
      tampered: false,
      expired: false,
      message: "Lisans başarıyla doğrulandı. Dijital imza ve geçerlilik süresi onaylandı.",
      payload: parsedPayload,
    };
  } catch (err: any) {
    return {
      valid: false,
      tampered: true,
      expired: false,
      message: `Doğrulama hatası: ${err?.message || "Bilinmeyen hata"}`,
      payload: null,
    };
  }
}
