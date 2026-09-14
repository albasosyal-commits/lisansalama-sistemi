import type { IncomingMessage, ServerResponse } from 'http';
import {
  getLicenseById,
  saveLicense,
  deleteLicense,
  addLicenseLog,
  signLicensePayload,
  LicensePayload,
} from '../../server/firebaseAdmin.js';

// DELETE /api/licenses/:id, PATCH /api/licenses/:id/status|extend|usage
// (Segmentsiz /api/licenses kök yolu ../licenses.ts dosyasında ayrı olarak ele alınıyor;
// Vercel'de Next.js olmayan Serverless Functions optional catch-all [[...x]] desteklemiyor.)
export default async function handler(
  req: IncomingMessage & { query?: any; body?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const segments: string[] = ([] as string[]).concat(req.query?.segments || []);
  const [id, subAction] = segments;

  if (!id) {
    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
    return;
  }

  try {
    // ------------------------------------------------------------
    // DELETE /api/licenses/:id
    // ------------------------------------------------------------
    if (req.method === 'DELETE' && !subAction) {
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
    if (req.method === 'PATCH' && subAction === 'status') {
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
    if (req.method === 'PATCH' && subAction === 'extend') {
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
    if (req.method === 'PATCH' && subAction === 'usage') {
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
        addLicenseLog(
          lic,
          'reset_usage',
          'Lisans kullanım durumu sıfırlandı ("Kullanımda Değil" durumuna alındı).',
          { reset_at: nowIso }
        );
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
    console.error('Error in /api/licenses/[...segments]:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Lisans işlemi sırasında hata oluştu.' }));
  }
}
