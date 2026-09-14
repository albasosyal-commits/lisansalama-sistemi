import type { IncomingMessage, ServerResponse } from 'http';
import { getLicenseById, saveLicense, addLicenseLog, verifyLicenseKeyString } from '../server/firebaseAdmin.js';

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
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  try {
    const { license_key, custom_public_key, target_machine_id, track_usage } = req.body || {};
    if (!license_key) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, message: 'Lisans anahtarı gereklidir.' }));
      return;
    }

    const result: any = await verifyLicenseKeyString(license_key, custom_public_key);

    let machineMatched: boolean | null = null;
    if (result.payload && result.payload.machine_id) {
      if (target_machine_id) {
        machineMatched =
          result.payload.machine_id.toLowerCase() === target_machine_id.trim().toLowerCase();
        if (!machineMatched) {
          result.valid = false;
          result.message += ` [UYARI: Makine ID eşleşmedi! Lisans: ${result.payload.machine_id}, Cihaz: ${target_machine_id}]`;
        }
      } else {
        machineMatched = false;
        result.message += " [BİLGİ: Bu lisans belirli bir Makine ID'ye kilitlidir]";
      }
    }

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
          wasUsed ? 'used' : 'activated',
          wasUsed
            ? `Sandbox testi: Lisans doğrulandı (Toplam ${stored.usage_count}. oturum).`
            : 'Sandbox testi: Lisans ile ilk kez giriş yapıldı (Durum: Kullanımda).',
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

    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, result: { ...result, machineMatched, licenseUsageInfo } }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Doğrulama hatası' }));
  }
}
