import type { IncomingMessage, ServerResponse } from 'http';
import { getLicenses, getProducts, getKeyMetadata } from '../firestoreStore.js';

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
    const [licenses, products, keyMeta] = await Promise.all([
      getLicenses(),
      getProducts(),
      getKeyMetadata(),
    ]);

    const now = new Date().getTime();
    let activeCount = 0;
    let revokedCount = 0;
    let expiredCount = 0;
    let demoCount = 0;
    let yearlyCount = 0;
    let customCount = 0;
    let usedCount = 0;
    let unusedCount = 0;

    licenses.forEach((lic) => {
      const exp = new Date(lic.expires_at).getTime();
      if (lic.status === 'revoked') {
        revokedCount++;
      } else if (now > exp) {
        expiredCount++;
      } else {
        activeCount++;
      }

      if (lic.is_used) {
        usedCount++;
      } else {
        unusedCount++;
      }

      if (lic.license_type === 'demo') demoCount++;
      else if (lic.license_type === 'yearly') yearlyCount++;
      else customCount++;
    });

    const response = {
      success: true,
      stats: {
        totalLicenses: licenses.length,
        activeLicenses: activeCount,
        revokedLicenses: revokedCount,
        expiredLicenses: expiredCount,
        totalProducts: products.length,
        demoCount,
        yearlyCount,
        customCount,
        usedCount,
        unusedCount,
      },
      keyInfo: {
        algorithm: keyMeta.algorithm,
        fingerprint: keyMeta.fingerprint,
        created_at: keyMeta.created_at,
      },
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Error fetching status' }));
  }
}
