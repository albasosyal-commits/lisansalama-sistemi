import type { IncomingMessage, ServerResponse } from 'http';
import { getLicenseById, saveLicense, addLicenseLog } from '../../../server/firebaseAdmin.js';

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
        JSON.stringify({
          success: false,
          message: "Geçersiz işlem ('mark_used' veya 'reset_usage' bekleniyor).",
        })
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
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Kullanım durumu güncellenemedi.' }));
  }
}
