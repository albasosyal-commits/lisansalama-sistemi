import type { IncomingMessage, ServerResponse } from 'http';
import {
  getLicenseById,
  saveLicense,
  addLicenseLog,
  signLicensePayload,
  LicensePayload,
} from '../../../server/firebaseAdmin.js';

export default async function handler(
  req: IncomingMessage & { body?: any; query?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'PATCH') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  try {
    const id = req.query?.id as string;
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

    if (lic.extra) {
      updatedPayload.extra = lic.extra;
    }

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
        message: `Lisans süresi ${newExpiresAt.toLocaleDateString(
          'tr-TR'
        )} tarihine kadar başarıyla uzatıldı ve yeni kriptografik imza üretildi.`,
        data: lic,
      })
    );
  } catch (err: any) {
    console.error('Error extending license:', err);
    res.statusCode = 500;
    res.end(
      JSON.stringify({ success: false, message: err?.message || 'Lisans süresi uzatılırken hata oluştu.' })
    );
  }
}
