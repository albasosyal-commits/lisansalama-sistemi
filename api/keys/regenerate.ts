import type { IncomingMessage, ServerResponse } from 'http';
import { regenerateKeyPair } from '../../server/firebaseAdmin.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Anahtar üretilemedi' }));
  }
}
