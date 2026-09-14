import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import {
  getLicenses,
  getLicenseById,
  getProducts,
  saveLicense,
  deleteLicense,
  addLicenseLog,
  signLicensePayload,
  StoredLicense,
  LicensePayload,
} from '../../server/firebaseAdmin.js';

// Tek dosyada birleştirilmiş: GET/POST /api/licenses, DELETE /api/licenses/:id,
// PATCH /api/licenses/:id/status|extend|usage
// (Vercel'in serverless function sayısı sınırını aşmamak için optional catch-all kullanıldı.)
export default async function handler(
  req: IncomingMessage & { query?: any; body?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const segments: string[] = ([] as string[]).concat(req.query?.segments || []);
  const [id, subAction] = segments;

  try {
    // ------------------------------------------------------------
    // GET /api/licenses  (liste + filtre)
    // ------------------------------------------------------------
    if (req.method === 'GET' && !id) {
      const { productId, status, type, usage, search } = req.query || {};
      let [licenses, products] = await Promise.all([getLicenses(), getProducts()]);

      licenses = licenses.map((lic) => {
        const prod = products.find((p) => p.productId === lic.product_id);
        return { ...lic, product_name: prod ? prod.name : lic.product_id };
      });

      if (productId && productId !== 'all') {
        licenses = licenses.filter((l) => l.product_id === productId);
      }
      if (status && status !== 'all') {
        const now = Date.now();
        if (status === 'active') {
          licenses = licenses.filter((l) => l.status === 'active' && new Date(l.expires_at).getTime() > now);
        } else if (status === 'revoked') {
          licenses = licenses.filter((l) => l.status === 'revoked');
        } else if (status === 'expired') {
          licenses = licenses.filter((l) => l.status === 'active' && new Date(l.expires_at).getTime() <= now);
        }
      }
      if (usage && usage !== 'all') {
        if (usage === 'used') licenses = licenses.filter((l) => l.is_used === true);
        else if (usage === 'unused') licenses = licenses.filter((l) => !l.is_used);
      }
      if (type && type !== 'all') {
        licenses = licenses.filter((l) => l.license_type === type);
      }
      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        licenses = licenses.filter(
          (l) =>
            l.customer.toLowerCase().includes(q) ||
            l.license_id.toLowerCase().includes(q) ||
            l.product_id.toLowerCase().includes(q) ||
            (l.machine_id && l.machine_id.toLowerCase().includes(q))
        );
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, data: licenses }));
      return;
    }

    // ------------------------------------------------------------
    // POST /api/licenses  (oluştur + imzala)
    // ------------------------------------------------------------
    if (req.method === 'POST' && !id) {
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
      } = req.body || {};

      if (!product_id || !customer || !license_type) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ success: false, message: 'Ürün, müşteri adı ve lisans tipi alanları zorunludur.' })
        );
        return;
      }

      const now = new Date();
      const issuedAtDate = custom_issued_at ? new Date(custom_issued_at) : now;
      let expiresAtDate: Date;

      if (license_type === 'demo') {
        expiresAtDate = new Date(issuedAtDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      } else if (license_type === 'yearly') {
        expiresAtDate = new Date(issuedAtDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else if (license_type === 'custom') {
        if (custom_expires_at) {
          expiresAtDate = new Date(custom_expires_at);
        } else if (days && Number(days) > 0) {
          expiresAtDate = new Date(issuedAtDate.getTime() + Number(days) * 24 * 60 * 60 * 1000);
        } else {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              success: false,
              message: 'Özel süreli lisans için geçerli bir bitiş tarihi veya gün sayısı giriniz.',
            })
          );
          return;
        }
      } else {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, message: 'Geçersiz lisans tipi.' }));
        return;
      }

      const license_id = crypto.randomUUID();
      const cleanMachineId = machine_id && machine_id.trim().length > 0 ? machine_id.trim() : null;

      const payload: LicensePayload = {
        license_id,
        product_id: String(product_id).trim(),
        license_type,
        customer: String(customer).trim(),
        issued_at: issuedAtDate.toISOString(),
        expires_at: expiresAtDate.toISOString(),
        machine_id: cleanMachineId,
      };
      if (extra && typeof extra === 'object' && Object.keys(extra).length > 0) {
        payload.extra = extra;
      }

      const raw_key = await signLicensePayload(payload);
      const products = await getProducts();
      const matchedProd = products.find((p) => p.productId === product_id);

      const storedLicense: StoredLicense = {
        license_id,
        product_id: String(product_id).trim(),
        product_name: matchedProd ? matchedProd.name : product_id,
        license_type,
        customer: String(customer).trim(),
        issued_at: payload.issued_at,
        expires_at: payload.expires_at,
        machine_id: cleanMachineId,
        status: 'active',
        raw_key,
        created_at: new Date().toISOString(),
        notes: notes ? String(notes).trim() : undefined,
        extra: payload.extra,
        logs: [],
        is_used: false,
        usage_count: 0,
        first_used_at: null,
        last_used_at: null,
        last_machine_id: null,
      };

      addLicenseLog(
        storedLicense,
        'created',
        `Lisans "${storedLicense.customer}" için ${
          license_type === 'demo' ? 'Demo (10 Gün)' : license_type === 'yearly' ? 'Yıllık (365 Gün)' : 'Özel'
        } lisansı olarak oluşturuldu. (Durum: Kullanımda Değil - Uygulama Girişi Bekleniyor)`,
        { issued_at: payload.issued_at, expires_at: payload.expires_at, machine_id: cleanMachineId }
      );

      await saveLicense(storedLicense);

      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          message: "Lisans başarıyla üretildi, imzalandı ve Firestore'a kaydedildi.",
          data: { license: storedLicense, payload, licenseKey: raw_key },
        })
      );
      return;
    }

    // ------------------------------------------------------------
    // DELETE /api/licenses/:id
    // ------------------------------------------------------------
    if (req.method === 'DELETE' && id && !subAction) {
      const lic = await getLicenseById(id);
      if (!lic) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Lisans bulunamadı.' }));
        return;
      }
      await deleteLicense(id);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: 'Lisans kaydı Firestore veritabanından silindi.' }));
      return;
    }

    // ------------------------------------------------------------
    // PATCH /api/licenses/:id/status
    // ------------------------------------------------------------
    if (req.method === 'PATCH' && id && subAction === 'status') {
      const { status } = req.body || {};
      if (status !== 'active' && status !== 'revoked' && status !== 'paused') {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ success: false, message: "Durum 'active', 'revoked' veya 'paused' olmalıdır." })
        );
        return;
      }

      const lic = await getLicenseById(id);
      if (!lic) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Lisans bulunamadı.' }));
        return;
      }

      const prevStatus = lic.status;
      lic.status = status;
      if (status === 'revoked') {
        lic.revoked_at = new Date().toISOString();
        lic.paused_at = null;
        addLicenseLog(lic, 'revoked', 'Lisans yönetici tarafından iptal edildi (revoked).', {
          revoked_at: lic.revoked_at,
        });
      } else if (status === 'paused') {
        lic.paused_at = new Date().toISOString();
        lic.revoked_at = null;
        addLicenseLog(lic, 'paused', 'Lisans geçici olarak donduruldu (paused).', {
          paused_at: lic.paused_at,
        });
      } else {
        lic.revoked_at = null;
        lic.paused_at = null;
        const logAction = prevStatus === 'paused' ? 'unpaused' : 'reactivated';
        const logDesc =
          prevStatus === 'paused'
            ? 'Lisans dondurması kaldırıldı ve tekrar aktif edildi.'
            : 'Lisans iptali kaldırıldı ve yeniden aktif edildi.';
        addLicenseLog(lic, logAction, logDesc);
      }

      await saveLicense(lic);
      let statusMessage = 'Lisans yeniden aktif edildi.';
      if (status === 'revoked') statusMessage = 'Lisans başarıyla iptal edildi (revoked).';
      if (status === 'paused') statusMessage = 'Lisans başarıyla donduruldu (paused).';

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, message: statusMessage, data: lic }));
      return;
    }

    // ------------------------------------------------------------
    // PATCH /api/licenses/:id/extend
    // ------------------------------------------------------------
    if (req.method === 'PATCH' && id && subAction === 'extend') {
      const { extendDays, customExpiresAt } = req.body || {};
      const lic = await getLicenseById(id);
      if (!lic) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Lisans bulunamadı.' }));
        return;
      }

      let newExpiresAt: Date;
      if (customExpiresAt) {
        newExpiresAt = new Date(customExpiresAt);
        if (isNaN(newExpiresAt.getTime())) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, message: 'Geçersiz özel bitiş tarihi.' }));
          return;
        }
      } else if (extendDays && Number(extendDays) > 0) {
        const currentExp = new Date(lic.expires_at);
        const baseDate = currentExp.getTime() > Date.now() ? currentExp : new Date();
        newExpiresAt = new Date(baseDate.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);
      } else {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            message: 'Lütfen uzatılacak gün sayısını veya geçerli bir bitiş tarihi belirtin.',
          })
        );
        return;
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
      if (lic.extra) updatedPayload.extra = lic.extra;

      const updatedRawKey = await signLicensePayload(updatedPayload);
      const oldExpDateStr = new Date(lic.expires_at).toLocaleDateString('tr-TR');
      const newExpDateStr = newExpiresAt.toLocaleDateString('tr-TR');

      lic.expires_at = updatedPayload.expires_at;
      lic.raw_key = updatedRawKey;

      addLicenseLog(
        lic,
        'extended',
        `Lisans süresi ${oldExpDateStr} tarihinden ${newExpDateStr} tarihine kadar uzatıldı.`,
        {
          previous_expires_at: lic.expires_at,
          new_expires_at: updatedPayload.expires_at,
          extend_days: extendDays || null,
        }
      );

      await saveLicense(lic);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: `Lisans süresi ${newExpiresAt.toLocaleDateString('tr-TR')} tarihine kadar başarıyla uzatıldı ve yeni kriptografik imza üretildi.`,
          data: lic,
        })
      );
      return;
    }

    // ------------------------------------------------------------
    // PATCH /api/licenses/:id/usage
    // ------------------------------------------------------------
    if (req.method === 'PATCH' && id && subAction === 'usage') {
      const { action, machine_id, app_version } = req.body || {};
      const lic = await getLicenseById(id);
      if (!lic) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Lisans bulunamadı.' }));
        return;
      }

      const nowIso = new Date().toISOString();
      if (action === 'mark_used') {
        const wasUsed = lic.is_used;
        lic.is_used = true;
        lic.usage_count = (lic.usage_count || 0) + 1;
        if (!lic.first_used_at) lic.first_used_at = nowIso;
        lic.last_used_at = nowIso;
        if (machine_id) lic.last_machine_id = machine_id;
        if (app_version) lic.app_version = app_version;

        addLicenseLog(
          lic,
          'activated',
          wasUsed
            ? `Uygulama lisans ile tekrar doğrulandı/giriş yaptı (Toplam ${lic.usage_count}. kez).`
            : 'Uygulama lisans ile ilk kez başarıyla giriş yaptı (Durum: Kullanımda).',
          { machine_id: machine_id || null, app_version: app_version || null, timestamp: nowIso }
        );
      } else if (action === 'reset_usage') {
        lic.is_used = false;
        lic.usage_count = 0;
        lic.first_used_at = null;
        lic.last_used_at = null;
        lic.last_machine_id = null;
        addLicenseLog(lic, 'reset_usage', 'Lisans kullanım durumu sıfırlandı ("Kullanımda Değil" durumuna alındı).', {
          reset_at: nowIso,
        });
      } else {
        res.statusCode = 400;
        res.end(
          JSON.stringify({ success: false, message: "Geçersiz işlem ('mark_used' veya 'reset_usage' bekleniyor)." })
        );
        return;
      }

      await saveLicense(lic);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          data: lic,
          message:
            action === 'mark_used'
              ? "Lisans 'Kullanımda' (Uygulama Girişi Yapıldı) olarak güncellendi."
              : "Lisans kullanım durumu sıfırlandı ('Kullanımda Değil').",
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  } catch (err: any) {
    console.error('Error in /api/licenses:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Lisans işlemi sırasında hata oluştu.' }));
  }
}
