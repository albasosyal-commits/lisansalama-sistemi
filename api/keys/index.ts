import type { IncomingMessage, ServerResponse } from 'http';
import { getKeyMetadata } from '../../server/firebaseAdmin.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const meta = await getKeyMetadata();
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, data: meta }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Anahtarlar yüklenemedi.' }));
  }
}
