import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import {
  getLicenseById,
  recordLicenseUsage,
  markLicenseRemovedFromApp,
  updateLicenseFields,
  deleteLicense,
  signLicensePayload,
  LicensePayload,
} from '../server/firebaseAdmin.js';

// Tek dosyada birleştirilmiş (vercel.json rewrite'larıyla yönlendirilir):
//   DELETE /api/licenses/:id          -> /api/license-item?id=:id
//   PATCH  /api/licenses/:id/status   -> /api/license-item?id=:id&action=status
//   PATCH  /api/licenses/:id/extend   -> /api/license-item?id=:id&action=extend
//   PATCH  /api/licenses/:id/usage    -> /api/license-item?id=:id&action=usage
export default async function handler(
  req: IncomingMessage & { body?: any; query?: any },
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

  const id = req.query?.id as string;
  const action = req.query?.action as string | undefined;

  if (!id) {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, message: 'Lisans ID gereklidir.' }));
    return;
  }

  try {
    // ------------------------------------------------------------
    // DELETE /api/licenses/:id
    // ------------------------------------------------------------
    if (req.method === 'DELETE' && !action) {
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
    if (req.method === 'PATCH' && action === 'status') {
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
      const nowIso = new Date().toISOString();
      let statusFields: Record<string, any>;
      let logAction: 'revoked' | 'paused' | 'unpaused' | 'reactivated';
      let logDesc: string;

      if (status === 'revoked') {
        statusFields = { status, revoked_at: nowIso, paused_at: null };
        logAction = 'revoked';
        logDesc = 'Lisans yönetici tarafından iptal edildi (revoked).';
      } else if (status === 'paused') {
        statusFields = { status, paused_at: nowIso, revoked_at: null };
        logAction = 'paused';
        logDesc = 'Lisans geçici olarak donduruldu (paused).';
      } else {
        statusFields = { status, revoked_at: null, paused_at: null };
        logAction = prevStatus === 'paused' ? 'unpaused' : 'reactivated';
        logDesc =
          prevStatus === 'paused'
            ? 'Lisans dondurması kaldırıldı ve tekrar aktif edildi.'
            : 'Lisans iptali kaldırıldı ve yeniden aktif edildi.';
      }

      // Hedefli güncelleme - saveLicense(lic) ile tüm nesneyi (is_used/usage_count
      // dahil) geri yazmaz; bu esnada gelen bir /api/v1/verify isteğinin kullanım
      // güncellemesini ezme riskini ortadan kaldırır.
      await updateLicenseFields(lic.license_id, statusFields, {
        id: 'log-' + crypto.randomUUID(),
        timestamp: nowIso,
        action: logAction,
        description: logDesc,
        details: statusFields,
      });

      Object.assign(lic, statusFields);

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
    if (req.method === 'PATCH' && action === 'extend') {
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
      const previousExpiresAt = lic.expires_at;
      const oldExpDateStr = new Date(previousExpiresAt).toLocaleDateString('tr-TR');
      const newExpDateStr = newExpiresAt.toLocaleDateString('tr-TR');
      const nowIso = new Date().toISOString();

      // Hedefli güncelleme - saveLicense(lic) ile tüm nesneyi geri yazmaz.
      await updateLicenseFields(
        lic.license_id,
        { expires_at: updatedPayload.expires_at, raw_key: updatedRawKey },
        {
          id: 'log-' + crypto.randomUUID(),
          timestamp: nowIso,
          action: 'extended',
          description: `Lisans süresi ${oldExpDateStr} tarihinden ${newExpDateStr} tarihine kadar uzatıldı.`,
          details: {
            previous_expires_at: previousExpiresAt,
            new_expires_at: updatedPayload.expires_at,
            extend_days: extendDays || null,
          },
        }
      );

      lic.expires_at = updatedPayload.expires_at;
      lic.raw_key = updatedRawKey;

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
    if (req.method === 'PATCH' && action === 'usage') {
      const { action: usageAction, machine_id, app_version } = req.body || {};
      const lic = await getLicenseById(id);
      if (!lic) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Lisans bulunamadı.' }));
        return;
      }

      const nowIso = new Date().toISOString();
      if (usageAction === 'mark_used') {
        const wasUsed = lic.is_used;
        const newUsageCount = (lic.usage_count || 0) + 1;
        const newFirstUsedAt = lic.first_used_at || nowIso;

        // Hedefli guncelleme - saveLicense(lic) ile tum nesneyi (status dahil) geri yazmaz.
        await recordLicenseUsage(
          lic.license_id,
          {
            is_used: true,
            usage_count: newUsageCount,
            first_used_at: newFirstUsedAt,
            last_used_at: nowIso,
            last_machine_id: machine_id || undefined,
            app_version: app_version || undefined,
          },
          {
            id: 'log-' + crypto.randomUUID(),
            timestamp: nowIso,
            action: 'activated',
            description: wasUsed
              ? `Uygulama lisans ile tekrar doğrulandı/giriş yaptı (Toplam ${newUsageCount}. kez).`
              : 'Uygulama lisans ile ilk kez başarıyla giriş yaptı (Durum: Kullanımda).',
            details: { machine_id: machine_id || null, app_version: app_version || null, timestamp: nowIso },
          }
        );

        lic.is_used = true;
        lic.usage_count = newUsageCount;
        lic.first_used_at = newFirstUsedAt;
        lic.last_used_at = nowIso;
        if (machine_id) lic.last_machine_id = machine_id;
        if (app_version) lic.app_version = app_version;

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            data: lic,
            message: "Lisans 'Kullanımda' (Uygulama Girişi Yapıldı) olarak güncellendi.",
          })
        );
        return;
      } else if (usageAction === 'mark_removed') {
        // İstemci uygulama kullanıcısı lisansı uygulamadan sildiğinde çağrılır.
        await markLicenseRemovedFromApp(lic.license_id, {
          id: 'log-' + crypto.randomUUID(),
          timestamp: nowIso,
          action: 'removed_from_app',
          description: 'Lisans, istemci uygulamadan (kullanıcı tarafından "Lisansı Sil" ile) kaldırıldı.',
          details: { machine_id: machine_id || null, timestamp: nowIso },
        });

        lic.is_used = false;
        lic.removed_from_app = true;
        lic.removed_from_app_at = nowIso;

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            success: true,
            data: lic,
            message: 'Lisansın istemci uygulamadan kaldırıldığı işaretlendi.',
          })
        );
        return;
      } else if (usageAction === 'reset_usage') {
        const resetFields = {
          is_used: false,
          usage_count: 0,
          first_used_at: null,
          last_used_at: null,
          last_machine_id: null,
          removed_from_app: false,
          removed_from_app_at: null,
        };
        await updateLicenseFields(lic.license_id, resetFields, {
          id: 'log-' + crypto.randomUUID(),
          timestamp: nowIso,
          action: 'reset_usage',
          description: 'Lisans kullanım durumu sıfırlandı ("Kullanımda Değil" durumuna alındı).',
          details: { reset_at: nowIso },
        });
        Object.assign(lic, resetFields);
      } else {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            message: "Geçersiz işlem ('mark_used', 'mark_removed' veya 'reset_usage' bekleniyor).",
          })
        );
        return;
      }

      // Buraya sadece 'reset_usage' dalı ulaşır (mark_used yukarıda erken donuyor).
      // Kayıt zaten yukarıda updateLicenseFields ile hedefli şekilde yapıldı.
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          data: lic,
          message: "Lisans kullanım durumu sıfırlandı ('Kullanımda Değil').",
        })
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  } catch (err: any) {
    console.error('Error in /api/license-item:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Lisans işlemi sırasında hata oluştu.' }));
  }
}
