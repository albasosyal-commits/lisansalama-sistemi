import type { IncomingMessage, ServerResponse } from 'http';

// Tek dosyada birleştirilmiş: GET/POST /api/firebase-config, POST /api/firebase-config/reset
const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'project-2f92977a-3f04-4243-aee',
  appId: '1:442102724532:web:a590cab1e8d12835cfa4e1',
  apiKey: 'AIzaSyBkVyJGHQmlKf-jjL6Q-MefI92pSTEOL0E',
  authDomain: 'project-2f92977a-3f04-4243-aee.firebaseapp.com',
  firestoreDatabaseId: 'lisanslamaaaa',
  storageBucket: 'project-2f92977a-3f04-4243-aee.firebasestorage.app',
  messagingSenderId: '442102724532',
  measurementId: '',
  oAuthClientId: '442102724532-nucjg3jqb21an6is7ggetufhsjlkav8m.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

export default function handler(
  req: IncomingMessage & { query?: any; body?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
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

  if (action === 'reset') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: 'Firebase ayarları varsayılana sıfırlandı.',
        data: DEFAULT_FIREBASE_CONFIG,
      })
    );
    return;
  }

  if (req.method === 'POST') {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: 'Firebase yapılandırması güncellendi.',
        data: req.body || DEFAULT_FIREBASE_CONFIG,
      })
    );
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, data: DEFAULT_FIREBASE_CONFIG }));
}
