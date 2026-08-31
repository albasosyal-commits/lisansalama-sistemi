import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const data = {
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

  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, data }));
}
