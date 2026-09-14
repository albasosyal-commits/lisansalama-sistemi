import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import {
  getLicenses,
  getProducts,
  saveLicense,
  addLicenseLog,
  signLicensePayload,
  StoredLicense,
  LicensePayload,
} from '../server/firebaseAdmin.js';

export default async function handler(
  req: IncomingMessage & { body?: any; query?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
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
          licenses = licenses.filter(
            (l) => l.status === 'active' && new Date(l.expires_at).getTime() > now
          );
        } else if (status === 'revoked') {
          licenses = licenses.filter((l) => l.status === 'revoked');
        } else if (status === 'expired') {
          licenses = licenses.filter(
            (l) => l.status === 'active' && new Date(l.expires_at).getTime() <= now
          );
        }
      }

      if (usage && usage !== 'all') {
        if (usage === 'used') {
          licenses = licenses.filter((l) => l.is_used === true);
        } else if (usage === 'unused') {
          licenses = licenses.filter((l) => !l.is_used);
        }
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

    if (req.method === 'POST') {
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
          JSON.stringify({
            success: false,
            message: 'Ürün, müşteri adı ve lisans tipi alanları zorunludur.',
          })
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
          expiresAtDate = new Date(
            issuedAtDate.getTime() + Number(days) * 24 * 60 * 60 * 1000
          );
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
      const cleanMachineId =
        machine_id && machine_id.trim().length > 0 ? machine_id.trim() : null;

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
        {
          issued_at: payload.issued_at,
          expires_at: payload.expires_at,
          machine_id: cleanMachineId,
        }
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

    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
  } catch (err: any) {
    console.error('Error in /api/licenses:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        message: err?.message || 'Lisans işlemi sırasında hata oluştu.',
      })
    );
  }
}
