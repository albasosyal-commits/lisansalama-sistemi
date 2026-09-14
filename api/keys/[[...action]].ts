import type { IncomingMessage, ServerResponse } from 'http';
import { getKeyMetadata, getPublicKeyPem, regenerateKeyPair } from '../../server/firebaseAdmin.js';

// Tek dosyada birleştirilmiş: GET /api/keys, GET /api/keys/public.pem, POST /api/keys/regenerate
// (Vercel'in serverless function sayısı sınırını aşmamak için optional catch-all kullanıldı.)
export default async function handler(
  req: IncomingMessage & { query?: any },
  res: ServerResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const segments: string[] = ([] as string[]).concat(req.query?.action || []);
  const action = segments[0] || '';

  try {
    if (action === 'public.pem' && req.method === 'GET') {
      const pem = await getPublicKeyPem();
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', 'attachment; filename="public_key.pem"');
      res.statusCode = 200;
      res.end(pem);
      return;
    }

    res.setHeader('Content-Type', 'application/json');

    if (action === 'regenerate' && req.method === 'POST') {
      const newConfig = await regenerateKeyPair();
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "Yeni 2048-bit RSA anahtar çifti başarıyla oluşturuldu ve Firestore'a kaydedildi.",
          data: {
            algorithm: newConfig.algorithm,
            keySize: newConfig.keySize,
            created_at: newConfig.created_at,
            fingerprint: newConfig.fingerprint,
            publicKey: newConfig.publicKey,
          },
        })
      );
      return;
    }

    if (!action && req.method === 'GET') {
      const meta = await getKeyMetadata();
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, data: meta }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Anahtar işlemi başarısız.' }));
  }
}
