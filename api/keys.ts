import type { IncomingMessage, ServerResponse } from 'http';
import { getKeyMetadata } from '../firestoreStore.js';

export default async function handler(req: IncomingMessage, res: ServerResponse & { json: (data: any) => void; status: (code: number) => any }) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const data = await getKeyMetadata();
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, data }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Error fetching keys' }));
  }
}

