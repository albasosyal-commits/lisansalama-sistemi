import type { IncomingMessage, ServerResponse } from 'http';
import { getLicenseById, recordLicenseUsage, verifyLicenseKeyString } from '../../server/firebaseAdmin.js';
import crypto from 'crypto';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ valid: false, error: 'METHOD_NOT_ALLOWED' }));
    return;
  }

  try {
    const { license_key, product_id, machine_id, app_version } = req.body || {};

    if (!license_key) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          valid: false,
          error: 'MISSING_LICENSE_KEY',
          message: 'Lisans anahtarı belirtilmedi.',
        })
      );
      return;
    }

    const cryptoResult: any = await verifyLicenseKeyString(license_key);
    if (cryptoResult.tampered || !cryptoResult.payload) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          valid: false,
          error: 'INVALID_SIGNATURE',
          message:
            cryptoResult.message ||
            'Dijital imza doğrulanamadı veya lisans anahtarı geçersiz/bozulmuş.',
          payload: cryptoResult.payload || null,
        })
      );
      return;
    }

    const payload = cryptoResult.payload;
    const stored = await getLicenseById(payload.license_id);

    const effectiveExpiresAt = stored ? stored.expires_at : payload.expires_at;
    const effectiveRawKey = stored ? stored.raw_key : license_key;
    const effectiveStatus = stored ? stored.status : 'active';
    const effectiveProductId = stored ? stored.product_id : payload.product_id;
    const effectiveMachineId = stored ? stored.machine_id : payload.machine_id;

    if (product_id && effectiveProductId !== product_id) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          valid: false,
          error: 'PRODUCT_MISMATCH',
          message: `Bu lisans "${effectiveProductId}" ürünü içindir, istenen ürün: "${product_id}".`,
          current_raw_key: effectiveRawKey,
          current_expires_at: effectiveExpiresAt,
          current_status: effectiveStatus,
          payload,
        })
      );
      return;
    }

    if (effectiveMachineId && machine_id) {
      if (effectiveMachineId.toLowerCase() !== machine_id.trim().toLowerCase()) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            valid: false,
            error: 'MACHINE_ID_MISMATCH',
            message: 'Lisans bu donanım kimliğine (Machine ID) ait değil.',
            current_raw_key: effectiveRawKey,
            current_expires_at: effectiveExpiresAt,
            current_status: effectiveStatus,
            payload,
          })
        );
        return;
      }
    }

    if (stored && stored.status === 'revoked') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          valid: false,
          error: 'LICENSE_REVOKED',
          message: 'Bu lisans yönetici tarafından iptal edilmiştir (Revoked).',
          current_raw_key: stored.raw_key,
          current_expires_at: stored.expires_at,
          current_status: stored.status,
          revoked_at: stored.revoked_at,
          payload,
        })
      );
      return;
    }

    if (stored && stored.status === 'paused') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          valid: false,
          error: 'LICENSE_PAUSED',
          message: 'Bu lisans yönetici tarafından geçici olarak dondurulmuştur (Paused).',
          current_raw_key: stored.raw_key,
          current_expires_at: stored.expires_at,
          current_status: stored.status,
          paused_at: stored.paused_at,
          payload,
        })
      );
      return;
    }

    const now = Date.now();
    const isExpired = new Date(effectiveExpiresAt).getTime() <= now;

    if (isExpired) {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          valid: false,
          error: 'LICENSE_EXPIRED',
          message: `Lisans süresi dolmuştur (${effectiveExpiresAt}).`,
          current_raw_key: effectiveRawKey,
          current_expires_at: effectiveExpiresAt,
          current_status: 'expired',
          payload,
        })
      );
      return;
    }

    if (stored) {
      const wasUsed = stored.is_used;
      const newUsageCount = (stored.usage_count || 0) + 1;
      const nowIso = new Date().toISOString();
      const newFirstUsedAt = stored.first_used_at || nowIso;

      // ÖNEMLİ: saveLicense(stored) ile TÜM lisans nesnesini (status, paused_at,
      // revoked_at dahil) geri YAZMA — bu, tam bu sırada bir yönetici tarafından
      // yapılan iptal/dondurma işlemini ezebilir (yarış durumu). Sadece kullanım
      // alanlarını hedefli şekilde güncelle.
      await recordLicenseUsage(
        stored.license_id,
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
          action: wasUsed ? 'used' : 'activated',
          description: wasUsed
            ? `Uygulama lisans ile tekrar doğrulandı/oturum açtı (Toplam: ${newUsageCount}. oturum).`
            : 'Uygulama ilk kez bu lisans ile başarıyla giriş yaptı (Durum: "Kullanımda").',
          details: {
            machine_id: machine_id || null,
            app_version: app_version || null,
            first_used_at: newFirstUsedAt,
            last_used_at: nowIso,
            usage_count: newUsageCount,
          },
        }
      );

      stored.is_used = true;
      stored.usage_count = newUsageCount;
      stored.first_used_at = newFirstUsedAt;
      stored.last_used_at = nowIso;
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        valid: true,
        message: 'Lisans çevrimiçi ve merkezi veritabanı ile başarıyla doğrulandı.',
        status: effectiveStatus,
        is_used: true,
        current_raw_key: effectiveRawKey,
        current_expires_at: effectiveExpiresAt,
        current_status: effectiveStatus,
        usage_count: stored ? stored.usage_count : 1,
        first_used_at: stored ? stored.first_used_at : new Date().toISOString(),
        last_used_at: stored ? stored.last_used_at : new Date().toISOString(),
        payload,
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        valid: false,
        error: 'INTERNAL_ERROR',
        message: err?.message || 'Doğrulama işlemi sırasında hata oluştu.',
      })
    );
  }
}
