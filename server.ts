import express from "express";
import path from "path";
import crypto from "crypto";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import {
  initializeKeys,
  getPrivateKeyPem,
  getPublicKeyPem,
  getKeyMetadata,
  getProducts,
  saveProducts,
  getLicenses,
  saveLicenses,
} from "./firestoreStore";
import {
  COLLECTIONS,
  SYSTEM_KEY_DOC_ID,
  Product,
  StoredLicense,
  LicensePayload,
  getStoredKeyConfig,
  saveStoredKeyConfig,
  regenerateKeyPair,
  saveProduct,
  deleteProduct,
  getLicenseById,
  saveLicense,
  deleteLicense,
  addLicenseLog,
  signLicensePayload,
  verifyLicenseKeyString,
} from "./server/firebaseAdmin";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: "5mb" }));

  // Pre-load keys on boot
  getStoredKeyConfig().catch((err) => {
    console.warn("Initial key warm-up:", err?.message || err);
  });

  // ----------------------------------------------------
  // 1. Dashboard / Status Summary
  // ----------------------------------------------------
  app.get("/api/status", async (req, res) => {
    try {
      const [licenses, products, keyMeta] = await Promise.all([
        getLicenses(),
        getProducts(),
        getKeyMetadata(),
      ]);

      const now = new Date().getTime();
      let activeCount = 0;
      let revokedCount = 0;
      let expiredCount = 0;
      let demoCount = 0;
      let yearlyCount = 0;
      let customCount = 0;
      let usedCount = 0;
      let unusedCount = 0;

      licenses.forEach((lic) => {
        const exp = new Date(lic.expires_at).getTime();
        if (lic.status === "revoked") {
          revokedCount++;
        } else if (now > exp) {
          expiredCount++;
        } else {
          activeCount++;
        }

        if (lic.is_used) {
          usedCount++;
        } else {
          unusedCount++;
        }

        if (lic.license_type === "demo") demoCount++;
        else if (lic.license_type === "yearly") yearlyCount++;
        else customCount++;
      });

      res.json({
        success: true,
        stats: {
          totalLicenses: licenses.length,
          activeLicenses: activeCount,
          revokedLicenses: revokedCount,
          expiredLicenses: expiredCount,
          totalProducts: products.length,
          demoCount,
          yearlyCount,
          customCount,
          usedCount,
          unusedCount,
        },
        keyInfo: {
          algorithm: keyMeta.algorithm,
          fingerprint: keyMeta.fingerprint,
          created_at: keyMeta.created_at,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Durum bilgisi alınamadı." });
    }
  });

  // ----------------------------------------------------
  // 2. Key Management API
  // ----------------------------------------------------
  app.get("/api/keys", async (req, res) => {
    try {
      const meta = await getKeyMetadata();
      res.json({
        success: true,
        data: meta,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Anahtarlar yüklenemedi." });
    }
  });

  app.get("/api/keys/public.pem", async (req, res) => {
    try {
      const pem = await getPublicKeyPem();
      res.setHeader("Content-Type", "application/x-pem-file");
      res.setHeader("Content-Disposition", 'attachment; filename="public_key.pem"');
      res.send(pem);
    } catch (e: any) {
      res.status(500).send("Public key read error: " + (e?.message || ""));
    }
  });

  app.post("/api/keys/regenerate", async (req, res) => {
    try {
      const newConfig = await regenerateKeyPair();
      res.json({
        success: true,
        message:
          "Yeni 2048-bit RSA anahtar çifti başarıyla oluşturuldu ve Firestore'a kaydedildi.",
        data: {
          algorithm: newConfig.algorithm,
          keySize: newConfig.keySize,
          created_at: newConfig.created_at,
          fingerprint: newConfig.fingerprint,
          publicKey: newConfig.publicKey,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Anahtar üretilemedi" });
    }
  });

  // ----------------------------------------------------
  // 2.5 Firebase Configuration API
  // ----------------------------------------------------
  const DEFAULT_FIREBASE_CONFIG = {
    projectId: "project-2f92977a-3f04-4243-aee",
    appId: "1:442102724532:web:a590cab1e8d12835cfa4e1",
    apiKey: "AIzaSyBkVyJGHQmlKf-jjL6Q-MefI92pSTEOL0E",
    authDomain: "project-2f92977a-3f04-4243-aee.firebaseapp.com",
    firestoreDatabaseId: "lisanslamaaaa",
    storageBucket: "project-2f92977a-3f04-4243-aee.firebasestorage.app",
    messagingSenderId: "442102724532",
    measurementId: "",
    oAuthClientId: "442102724532-nucjg3jqb21an6is7ggetufhsjlkav8m.apps.googleusercontent.com",
    recaptchaSiteKey: "",
  };

  app.get("/api/firebase-config", (req, res) => {
    return res.json({
      success: true,
      data: DEFAULT_FIREBASE_CONFIG,
    });
  });

  app.post("/api/firebase-config", (req, res) => {
    return res.json({
      success: true,
      message: "Firebase yapılandırması güncellendi.",
      data: req.body || DEFAULT_FIREBASE_CONFIG,
    });
  });

  app.post("/api/firebase-config/reset", (req, res) => {
    return res.json({
      success: true,
      message: "Firebase ayarları varsayılana sıfırlandı.",
      data: DEFAULT_FIREBASE_CONFIG,
    });
  });

  // ----------------------------------------------------
  // 3. Products API
  // ----------------------------------------------------
  app.get("/api/products", async (req, res) => {
    try {
      const [products, licenses] = await Promise.all([getProducts(), getLicenses()]);

      // Attach license count to each product
      const productsWithCount = products.map((prod) => {
        const count = licenses.filter((l) => l.product_id === prod.productId).length;
        const activeCount = licenses.filter(
          (l) =>
            l.product_id === prod.productId &&
            l.status === "active" &&
            new Date(l.expires_at).getTime() > Date.now()
        ).length;
        return {
          ...prod,
          licenseCount: count,
          activeLicenseCount: activeCount,
        };
      });

      res.json({ success: true, data: productsWithCount });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Ürünler alınamadı." });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { name, productId, description, version } = req.body;
      if (!name || !productId) {
        return res.status(400).json({
          success: false,
          message: "Ürün adı ve Ürün Kodu (product_id) zorunludur.",
        });
      }

      const cleanProductId = productId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-");
      const products = await getProducts();

      if (products.some((p) => p.productId === cleanProductId)) {
        return res.status(400).json({
          success: false,
          message: "Bu Ürün Kodu (product_id) zaten kullanımda.",
        });
      }

      const newProduct: Product = {
        id: cleanProductId,
        name: name.trim(),
        productId: cleanProductId,
        description: description ? description.trim() : "",
        version: version ? version.trim() : "1.0.0",
        created_at: new Date().toISOString(),
      };

      await saveProduct(newProduct);

      res.status(201).json({
        success: true,
        data: newProduct,
        message: "Ürün başarıyla Firestore veritabanına eklendi.",
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Ürün eklenemedi." });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cleanId = id.trim().toLowerCase();
      const products = await getProducts();
      const product = products.find((p) => p.id === cleanId || p.productId === cleanId);
      const targetId = product ? product.productId : cleanId;

      await deleteProduct(targetId);

      res.json({
        success: true,
        message: `Ürün (${targetId}) başarıyla Firestore veritabanından silindi.`,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Ürün silinemedi." });
    }
  });

  // ----------------------------------------------------
  // 4. Licenses API
  // ----------------------------------------------------
  app.get("/api/licenses", async (req, res) => {
    try {
      const { productId, status, type, usage, search } = req.query;
      let [licenses, products] = await Promise.all([getLicenses(), getProducts()]);

      // Attach product name for display
      licenses = licenses.map((lic) => {
        const prod = products.find((p) => p.productId === lic.product_id);
        return {
          ...lic,
          product_name: prod ? prod.name : lic.product_id,
        };
      });

      if (productId && productId !== "all") {
        licenses = licenses.filter((l) => l.product_id === productId);
      }

      if (status && status !== "all") {
        const now = Date.now();
        if (status === "active") {
          licenses = licenses.filter(
            (l) => l.status === "active" && new Date(l.expires_at).getTime() > now
          );
        } else if (status === "revoked") {
          licenses = licenses.filter((l) => l.status === "revoked");
        } else if (status === "expired") {
          licenses = licenses.filter(
            (l) => l.status === "active" && new Date(l.expires_at).getTime() <= now
          );
        }
      }

      if (usage && usage !== "all") {
        if (usage === "used") {
          licenses = licenses.filter((l) => l.is_used === true);
        } else if (usage === "unused") {
          licenses = licenses.filter((l) => !l.is_used);
        }
      }

      if (type && type !== "all") {
        licenses = licenses.filter((l) => l.license_type === type);
      }

      if (search && typeof search === "string") {
        const q = search.toLowerCase();
        licenses = licenses.filter(
          (l) =>
            l.customer.toLowerCase().includes(q) ||
            l.license_id.toLowerCase().includes(q) ||
            l.product_id.toLowerCase().includes(q) ||
            (l.machine_id && l.machine_id.toLowerCase().includes(q))
        );
      }

      res.json({ success: true, data: licenses });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Lisanslar alınamadı." });
    }
  });

  app.post("/api/licenses", async (req, res) => {
    try {
      const {
        product_id,
        customer,
        license_type,
        custom_issued_at,
        custom_expires_at,
        days,
        machine_id,
        notes,
        extra,
      } = req.body;

      if (!product_id || !customer || !license_type) {
        return res.status(400).json({
          success: false,
          message: "Ürün, müşteri adı ve lisans tipi alanları zorunludur.",
        });
      }

      // Calculate UTC timestamps
      const now = new Date();
      const issuedAtDate = custom_issued_at ? new Date(custom_issued_at) : now;
      let expiresAtDate: Date;

      if (license_type === "demo") {
        expiresAtDate = new Date(issuedAtDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      } else if (license_type === "yearly") {
        expiresAtDate = new Date(issuedAtDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else if (license_type === "custom") {
        if (custom_expires_at) {
          expiresAtDate = new Date(custom_expires_at);
        } else if (days && Number(days) > 0) {
          expiresAtDate = new Date(
            issuedAtDate.getTime() + Number(days) * 24 * 60 * 60 * 1000
          );
        } else {
          return res.status(400).json({
            success: false,
            message: "Özel süreli lisans için geçerli bir bitiş tarihi veya gün sayısı giriniz.",
          });
        }
      } else {
        return res.status(400).json({ success: false, message: "Geçersiz lisans tipi." });
      }

      const license_id = crypto.randomUUID();
      const cleanMachineId =
        machine_id && machine_id.trim().length > 0 ? machine_id.trim() : null;

      const payload: LicensePayload = {
        license_id,
        product_id: product_id.trim(),
        license_type,
        customer: customer.trim(),
        issued_at: issuedAtDate.toISOString(),
        expires_at: expiresAtDate.toISOString(),
        machine_id: cleanMachineId,
      };

      if (extra && typeof extra === "object" && Object.keys(extra).length > 0) {
        payload.extra = extra;
      }

      // Sign payload with RSA-SHA256
      const raw_key = await signLicensePayload(payload);

      const products = await getProducts();
      const matchedProd = products.find((p) => p.productId === product_id);

      const storedLicense: StoredLicense = {
        license_id,
        product_id: product_id.trim(),
        product_name: matchedProd ? matchedProd.name : product_id,
        license_type,
        customer: customer.trim(),
        issued_at: payload.issued_at,
        expires_at: payload.expires_at,
        machine_id: cleanMachineId,
        status: "active",
        raw_key,
        created_at: new Date().toISOString(),
        notes: notes ? notes.trim() : undefined,
        extra: payload.extra,
        logs: [],
        // Usage initialization
        is_used: false,
        usage_count: 0,
        first_used_at: null,
        last_used_at: null,
        last_machine_id: null,
      };

      addLicenseLog(
        storedLicense,
        "created",
        `Lisans "${storedLicense.customer}" için ${
          license_type === "demo"
            ? "Demo (10 Gün)"
            : license_type === "yearly"
            ? "Yıllık (365 Gün)"
            : "Özel"
        } lisansı olarak oluşturuldu. (Durum: Kullanımda Değil - Uygulama Girişi Bekleniyor)`,
        {
          issued_at: payload.issued_at,
          expires_at: payload.expires_at,
          machine_id: cleanMachineId,
        }
      );

      await saveLicense(storedLicense);

      res.status(201).json({
        success: true,
        message: "Lisans başarıyla üretildi, imzalandı ve Firestore'a kaydedildi.",
        data: {
          license: storedLicense,
          payload,
          licenseKey: raw_key,
        },
      });
    } catch (e: any) {
      console.error("Error creating license:", e);
      res.status(500).json({
        success: false,
        message: e?.message || "Lisans üretilirken hata oluştu.",
      });
    }
  });

  // ----------------------------------------------------
  // 5. Revoke / Pause / Reactivate License
  // ----------------------------------------------------
  app.patch("/api/licenses/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (status !== "active" && status !== "revoked" && status !== "paused") {
        return res.status(400).json({
          success: false,
          message: "Durum 'active', 'revoked' veya 'paused' olmalıdır.",
        });
      }

      const lic = await getLicenseById(id);
      if (!lic) {
        return res.status(404).json({ success: false, message: "Lisans bulunamadı." });
      }

      const prevStatus = lic.status;
      lic.status = status;
      if (status === "revoked") {
        lic.revoked_at = new Date().toISOString();
        lic.paused_at = null;
        addLicenseLog(
          lic,
          "revoked",
          `Lisans yönetici tarafından iptal edildi (revoked).`,
          { revoked_at: lic.revoked_at }
        );
      } else if (status === "paused") {
        lic.paused_at = new Date().toISOString();
        lic.revoked_at = null;
        addLicenseLog(
          lic,
          "paused",
          `Lisans geçici olarak donduruldu (paused).`,
          { paused_at: lic.paused_at }
        );
      } else {
        lic.revoked_at = null;
        lic.paused_at = null;
        const logAction = prevStatus === "paused" ? "unpaused" : "reactivated";
        const logDesc =
          prevStatus === "paused"
            ? "Lisans dondurması kaldırıldı ve tekrar aktif edildi."
            : "Lisans iptali kaldırıldı ve yeniden aktif edildi.";
        addLicenseLog(lic, logAction, logDesc);
      }

      await saveLicense(lic);
      let statusMessage = "Lisans yeniden aktif edildi.";
      if (status === "revoked") statusMessage = "Lisans başarıyla iptal edildi (revoked).";
      if (status === "paused") statusMessage = "Lisans başarıyla donduruldu (paused).";

      res.json({
        success: true,
        message: statusMessage,
        data: lic,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Durum güncellenemedi." });
    }
  });

  // ----------------------------------------------------
  // 5.1 Extend License Expiration
  // ----------------------------------------------------
  app.patch("/api/licenses/:id/extend", async (req, res) => {
    try {
      const { id } = req.params;
      const { extendDays, customExpiresAt } = req.body;

      const lic = await getLicenseById(id);
      if (!lic) {
        return res.status(404).json({ success: false, message: "Lisans bulunamadı." });
      }

      let newExpiresAt: Date;

      if (customExpiresAt) {
        newExpiresAt = new Date(customExpiresAt);
        if (isNaN(newExpiresAt.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Geçersiz özel bitiş tarihi.",
          });
        }
      } else if (extendDays && Number(extendDays) > 0) {
        const currentExp = new Date(lic.expires_at);
        const baseDate = currentExp.getTime() > Date.now() ? currentExp : new Date();
        newExpiresAt = new Date(
          baseDate.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000
        );
      } else {
        return res.status(400).json({
          success: false,
          message: "Lütfen uzatılacak gün sayısını veya geçerli bir bitiş tarihi belirtin.",
        });
      }

      const updatedPayload: LicensePayload = {
        license_id: lic.license_id,
        product_id: lic.product_id,
        license_type: lic.license_type,
        customer: lic.customer,
        issued_at: lic.issued_at,
        expires_at: newExpiresAt.toISOString(),
        machine_id: lic.machine_id,
      };

      if (lic.extra) {
        updatedPayload.extra = lic.extra;
      }

      // Re-sign with private key so offline checks reflect the new expiration date
      const updatedRawKey = await signLicensePayload(updatedPayload);

      const oldExpDateStr = new Date(lic.expires_at).toLocaleDateString("tr-TR");
      const newExpDateStr = newExpiresAt.toLocaleDateString("tr-TR");

      lic.expires_at = updatedPayload.expires_at;
      lic.raw_key = updatedRawKey;

      addLicenseLog(
        lic,
        "extended",
        `Lisans süresi ${oldExpDateStr} tarihinden ${newExpDateStr} tarihine kadar uzatıldı.`,
        {
          previous_expires_at: lic.expires_at,
          new_expires_at: updatedPayload.expires_at,
          extend_days: extendDays || null,
        }
      );

      await saveLicense(lic);

      res.json({
        success: true,
        message: `Lisans süresi ${newExpiresAt.toLocaleDateString(
          "tr-TR"
        )} tarihine kadar başarıyla uzatıldı ve yeni kriptografik imza üretildi.`,
        data: lic,
      });
    } catch (e: any) {
      console.error("Error extending license:", e);
      res.status(500).json({
        success: false,
        message: e?.message || "Lisans süresi uzatılırken hata oluştu.",
      });
    }
  });

  app.delete("/api/licenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const lic = await getLicenseById(id);
      if (!lic) {
        return res.status(404).json({ success: false, message: "Lisans bulunamadı." });
      }

      await deleteLicense(id);
      res.json({ success: true, message: "Lisans kaydı Firestore veritabanından silindi." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Lisans silinemedi." });
    }
  });

  // ----------------------------------------------------
  // 5.2 Toggle or Reset License Usage
  // ----------------------------------------------------
  app.patch("/api/licenses/:id/usage", async (req, res) => {
    try {
      const { id } = req.params;
      const { action, machine_id, app_version } = req.body;

      const lic = await getLicenseById(id);
      if (!lic) {
        return res.status(404).json({ success: false, message: "Lisans bulunamadı." });
      }

      const nowIso = new Date().toISOString();

      if (action === "mark_used") {
        const wasUsed = lic.is_used;
        lic.is_used = true;
        lic.usage_count = (lic.usage_count || 0) + 1;
        if (!lic.first_used_at) lic.first_used_at = nowIso;
        lic.last_used_at = nowIso;
        if (machine_id) lic.last_machine_id = machine_id;
        if (app_version) lic.app_version = app_version;

        addLicenseLog(
          lic,
          "activated",
          wasUsed
            ? `Uygulama lisans ile tekrar doğrulandı/giriş yaptı (Toplam ${lic.usage_count}. kez).`
            : `Uygulama lisans ile ilk kez başarıyla giriş yaptı (Durum: Kullanımda).`,
          {
            machine_id: machine_id || null,
            app_version: app_version || null,
            timestamp: nowIso,
          }
        );
      } else if (action === "reset_usage") {
        lic.is_used = false;
        lic.usage_count = 0;
        lic.first_used_at = null;
        lic.last_used_at = null;
        lic.last_machine_id = null;

        addLicenseLog(
          lic,
          "reset_usage",
          `Lisans kullanım durumu sıfırlandı ("Kullanımda Değil" durumuna alındı).`,
          { reset_at: nowIso }
        );
      } else {
        return res.status(400).json({
          success: false,
          message: "Geçersiz işlem ('mark_used' veya 'reset_usage' bekleniyor).",
        });
      }

      await saveLicense(lic);
      res.json({
        success: true,
        data: lic,
        message:
          action === "mark_used"
            ? "Lisans 'Kullanımda' (Uygulama Girişi Yapıldı) olarak güncellendi."
            : "Lisans kullanım durumu sıfırlandı ('Kullanımda Değil').",
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Kullanım durumu güncellenemedi." });
    }
  });

  // ----------------------------------------------------
  // 6. Offline Verification Sandbox API
  // ----------------------------------------------------
  app.post("/api/verify-offline", async (req, res) => {
    try {
      const { license_key, custom_public_key, target_machine_id, track_usage } =
        req.body;
      if (!license_key) {
        return res.status(400).json({
          success: false,
          message: "Lisans anahtarı gereklidir.",
        });
      }

      const result = await verifyLicenseKeyString(license_key, custom_public_key);

      // If machine ID check is requested
      let machineMatched: boolean | null = null;
      if (result.payload && result.payload.machine_id) {
        if (target_machine_id) {
          machineMatched =
            result.payload.machine_id.toLowerCase() ===
            target_machine_id.trim().toLowerCase();
          if (!machineMatched) {
            result.valid = false;
            result.message += ` [UYARI: Makine ID eşleşmedi! Lisans: ${result.payload.machine_id}, Cihaz: ${target_machine_id}]`;
          }
        } else {
          machineMatched = false;
          result.message += " [BİLGİ: Bu lisans belirli bir Makine ID'ye kilitlidir]";
        }
      }

      // Track usage if valid and requested
      let licenseUsageInfo = null;
      if (result.valid && result.payload) {
        const stored = await getLicenseById(result.payload.license_id);
        if (stored && track_usage) {
          const wasUsed = stored.is_used;
          stored.is_used = true;
          stored.usage_count = (stored.usage_count || 0) + 1;
          const nowIso = new Date().toISOString();
          if (!stored.first_used_at) stored.first_used_at = nowIso;
          stored.last_used_at = nowIso;
          if (target_machine_id) stored.last_machine_id = target_machine_id;

          addLicenseLog(
            stored,
            wasUsed ? "used" : "activated",
            wasUsed
              ? `Sandbox testi: Lisans doğrulandı (Toplam ${stored.usage_count}. oturum).`
              : `Sandbox testi: Lisans ile ilk kez giriş yapıldı (Durum: Kullanımda).`,
            { machine_id: target_machine_id || null, sandbox: true }
          );
          await saveLicense(stored);
        }
        if (stored) {
          licenseUsageInfo = {
            is_used: stored.is_used,
            usage_count: stored.usage_count || 0,
            first_used_at: stored.first_used_at,
            last_used_at: stored.last_used_at,
          };
        }
      }

      res.json({
        success: true,
        result: {
          ...result,
          machineMatched,
          licenseUsageInfo,
        },
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e?.message || "Doğrulama hatası" });
    }
  });

  // ----------------------------------------------------
  // 7. Online Verification Endpoint for External Applications (REST API)
  // ----------------------------------------------------
  app.post("/api/v1/verify", async (req, res) => {
    try {
      const { license_key, product_id, machine_id, app_version } = req.body;

      if (!license_key) {
        return res.status(400).json({
          valid: false,
          error: "MISSING_LICENSE_KEY",
          message: "Lisans anahtarı belirtilmedi.",
        });
      }

      // First cryptographically verify that the signature legitimately belongs to this server
      const cryptoResult = await verifyLicenseKeyString(license_key);
      if (cryptoResult.tampered || !cryptoResult.payload) {
        return res.status(200).json({
          valid: false,
          error: "INVALID_SIGNATURE",
          message:
            cryptoResult.message ||
            "Dijital imza doğrulanamadı veya lisans anahtarı geçersiz/bozulmuş.",
          payload: cryptoResult.payload || null,
        });
      }

      const payload = cryptoResult.payload;

      // Check central database for stored license record
      const stored = await getLicenseById(payload.license_id);

      const effectiveExpiresAt = stored ? stored.expires_at : payload.expires_at;
      const effectiveRawKey = stored ? stored.raw_key : license_key;
      const effectiveStatus = stored ? stored.status : "active";
      const effectiveProductId = stored ? stored.product_id : payload.product_id;
      const effectiveMachineId = stored ? stored.machine_id : payload.machine_id;

      // Optional product_id match check
      if (product_id && effectiveProductId !== product_id) {
        return res.status(200).json({
          valid: false,
          error: "PRODUCT_MISMATCH",
          message: `Bu lisans "${effectiveProductId}" ürünü içindir, istenen ürün: "${product_id}".`,
          current_raw_key: effectiveRawKey,
          current_expires_at: effectiveExpiresAt,
          current_status: effectiveStatus,
          payload,
        });
      }

      // Optional machine_id match check
      if (effectiveMachineId && machine_id) {
        if (effectiveMachineId.toLowerCase() !== machine_id.trim().toLowerCase()) {
          return res.status(200).json({
            valid: false,
            error: "MACHINE_ID_MISMATCH",
            message: "Lisans bu donanım kimliğine (Machine ID) ait değil.",
            current_raw_key: effectiveRawKey,
            current_expires_at: effectiveExpiresAt,
            current_status: effectiveStatus,
            payload,
          });
        }
      }

      // Revocation check
      if (stored && stored.status === "revoked") {
        return res.status(200).json({
          valid: false,
          error: "LICENSE_REVOKED",
          message: "Bu lisans yönetici tarafından iptal edilmiştir (Revoked).",
          current_raw_key: stored.raw_key,
          current_expires_at: stored.expires_at,
          current_status: stored.status,
          revoked_at: stored.revoked_at,
          payload,
        });
      }

      // Paused check
      if (stored && stored.status === "paused") {
        return res.status(200).json({
          valid: false,
          error: "LICENSE_PAUSED",
          message: "Bu lisans yönetici tarafından geçici olarak dondurulmuştur (Paused).",
          current_raw_key: stored.raw_key,
          current_expires_at: stored.expires_at,
          current_status: stored.status,
          paused_at: stored.paused_at,
          payload,
        });
      }

      // Expiration check based on stored database record if present
      const now = Date.now();
      const isExpired = new Date(effectiveExpiresAt).getTime() <= now;

      if (isExpired) {
        return res.status(200).json({
          valid: false,
          error: "LICENSE_EXPIRED",
          message: `Lisans süresi dolmuştur (${effectiveExpiresAt}).`,
          current_raw_key: effectiveRawKey,
          current_expires_at: effectiveExpiresAt,
          current_status: "expired",
          payload,
        });
      }

      // Mark as used / record application login check-in
      if (stored) {
        const wasUsed = stored.is_used;
        stored.is_used = true;
        stored.usage_count = (stored.usage_count || 0) + 1;
        const nowIso = new Date().toISOString();
        if (!stored.first_used_at) {
          stored.first_used_at = nowIso;
        }
        stored.last_used_at = nowIso;
        if (machine_id) {
          stored.last_machine_id = machine_id;
        }
        if (app_version) {
          stored.app_version = app_version;
        }

        addLicenseLog(
          stored,
          wasUsed ? "used" : "activated",
          wasUsed
            ? `Uygulama lisans ile tekrar doğrulandı/oturum açtı (Toplam: ${stored.usage_count}. oturum).`
            : `Uygulama ilk kez bu lisans ile başarıyla giriş yaptı (Durum: "Kullanımda").`,
          {
            machine_id: machine_id || null,
            app_version: app_version || null,
            first_used_at: stored.first_used_at,
            last_used_at: stored.last_used_at,
            usage_count: stored.usage_count,
          }
        );
        await saveLicense(stored);
      }

      return res.status(200).json({
        valid: true,
        message: "Lisans çevrimiçi ve merkezi veritabanı ile başarıyla doğrulandı.",
        status: effectiveStatus,
        is_used: true,
        current_raw_key: effectiveRawKey,
        current_expires_at: effectiveExpiresAt,
        current_status: effectiveStatus,
        usage_count: stored ? stored.usage_count : 1,
        first_used_at: stored ? stored.first_used_at : new Date().toISOString(),
        last_used_at: stored ? stored.last_used_at : new Date().toISOString(),
        payload,
      });
    } catch (e: any) {
      res.status(500).json({
        valid: false,
        error: "INTERNAL_ERROR",
        message: e?.message || "Doğrulama işlemi sırasında hata oluştu.",
      });
    }
  });

  // ----------------------------------------------------
  // Vite Middleware & Static Serving
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`License Generator Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
