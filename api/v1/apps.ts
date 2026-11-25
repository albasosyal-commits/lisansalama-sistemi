import type { IncomingMessage, ServerResponse } from 'http';
import { getLicenses, getProducts } from '../../server/firebaseAdmin.js';
import { selectApprovedClubs } from '../../server/appDomain.js';

// GET /api/v1/apps — herkese açık.
// Sosyalritim mobil uygulamasının "Kurum seç" listesi: yalnız onaylı kulüplerin
// adı ve site adresi döner (anahtar, lisans ID'si vb. HİÇBİR ek alan dönmez).
// Onay kuralı server/appDomain.ts → selectApprovedClubs içinde.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, OPTIONS');
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  try {
    const [licenses, products] = await Promise.all([getLicenses(), getProducts()]);
    const clubs = selectApprovedClubs(licenses, products);
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
    res.end(JSON.stringify({ success: true, clubs }));
  } catch (err: any) {
    console.error('Error in /api/v1/apps:', err);
    res.statusCode = 500;
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ success: false, message: 'Kulüp listesi alınamadı.' }));
  }
}
