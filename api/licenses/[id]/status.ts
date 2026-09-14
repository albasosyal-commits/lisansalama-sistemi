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
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Durum güncellenemedi.' }));
  }
}
