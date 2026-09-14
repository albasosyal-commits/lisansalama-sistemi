import type { IncomingMessage, ServerResponse } from 'http';
import { getLicenseById, deleteLicense } from '../../../server/firebaseAdmin.js';

export default async function handler(
  req: IncomingMessage & { query?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'DELETE') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  try {
    const id = req.query?.id as string;
    const lic = await getLicenseById(id);
    if (!lic) {
      res.statusCode = 404;
      res.end(JSON.stringify({ success: false, message: 'Lisans bulunamadı.' }));
      return;
    }

    await deleteLicense(id);
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, message: 'Lisans kaydı Firestore veritabanından silindi.' }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Lisans silinemedi.' }));
  }
}
