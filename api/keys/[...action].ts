import type { IncomingMessage, ServerResponse } from 'http';
import { getPublicKeyPem, regenerateKeyPair } from '../../server/firebaseAdmin.js';

// GET /api/keys/public.pem, POST /api/keys/regenerate
// (Vercel Serverless Functions - Next.js olmayan projelerde optional catch-all
// [[...x]] desteklenmiyor; bu yüzden zorunlu catch-all [...x] kullanıldı ve
// segmentsiz kök yol için ayrı api/keys.ts dosyası var.)
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

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Anahtar işlemi başarısız.' }));
  }
}
