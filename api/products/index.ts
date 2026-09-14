import type { IncomingMessage, ServerResponse } from 'http';
import { getProducts, getLicenses, saveProduct, Product } from '../../server/firebaseAdmin.js';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
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
    if (req.method === 'GET') {
      const [products, licenses] = await Promise.all([getProducts(), getLicenses()]);

      const productsWithCount = products.map((prod) => {
        const count = licenses.filter((l) => l.product_id === prod.productId).length;
        const activeCount = licenses.filter(
          (l) =>
            l.product_id === prod.productId &&
            l.status === 'active' &&
            new Date(l.expires_at).getTime() > Date.now()
        ).length;
        return { ...prod, licenseCount: count, activeLicenseCount: activeCount };
      });

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, data: productsWithCount }));
      return;
    }

    if (req.method === 'POST') {
      const { name, productId, description, version } = req.body || {};
      if (!name || !productId) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            message: 'Ürün adı ve Ürün Kodu (product_id) zorunludur.',
          })
        );
        return;
      }

      const cleanProductId = String(productId).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const products = await getProducts();

      if (products.some((p) => p.productId === cleanProductId)) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            success: false,
            message: 'Bu Ürün Kodu (product_id) zaten kullanımda.',
          })
        );
        return;
      }

      const newProduct: Product = {
        id: cleanProductId,
        name: String(name).trim(),
        productId: cleanProductId,
        description: description ? String(description).trim() : '',
        version: version ? String(version).trim() : '1.0.0',
        created_at: new Date().toISOString(),
      };

      await saveProduct(newProduct);

      res.statusCode = 201;
      res.end(
        JSON.stringify({
          success: true,
          data: newProduct,
          message: 'Ürün başarıyla Firestore veritabanına eklendi.',
        })
      );
      return;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Ürünler alınamadı.' }));
  }
}
