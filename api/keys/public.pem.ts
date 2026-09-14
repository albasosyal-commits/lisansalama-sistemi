import type { IncomingMessage, ServerResponse } from 'http';
import { getPublicKeyPem } from '../../server/firebaseAdmin.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const pem = await getPublicKeyPem();
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="public_key.pem"');
    res.statusCode = 200;
    res.end(pem);
  } catch (err: any) {
    res.statusCode = 500;
    res.end('Public key read error: ' + (err?.message || ''));
  }
}
