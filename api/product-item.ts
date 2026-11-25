import type { IncomingMessage, ServerResponse } from 'http';
import { getProducts, deleteProduct, saveProduct, Product } from '../server/firebaseAdmin.js';

// DELETE /api/products/:id (vercel.json rewrite) -> /api/product-item?id=:id
// PATCH  /api/products/:id  body {mobile_app: boolean} -> ürün işaretini günceller
export default async function handler(
  req: IncomingMessage & { query?: any; body?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  try {
    const id = req.query?.id as string;
    const cleanId = String(id || '').trim().toLowerCase();
    if (!cleanId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ success: false, message: 'Ürün ID gereklidir.' }));
      return;
    }
    const products = await getProducts();
    const product = products.find((p) => p.id === cleanId || p.productId === cleanId);

    if (req.method === 'PATCH') {
      const { mobile_app } = req.body || {};
      if (typeof mobile_app !== 'boolean') {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, message: 'mobile_app alanı true/false olmalıdır.' }));
        return;
      }
      if (!product) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, message: 'Ürün bulunamadı.' }));
        return;
      }
      const { licenseCount, activeLicenseCount, ...rest } = product;
      const updated: Product = { ...rest, mobile_app };
      await saveProduct(updated);
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          data: updated,
          message: mobile_app
            ? 'Ürün mobil uygulamada kullanılır olarak işaretlendi.'
            : 'Ürünün mobil uygulama işareti kaldırıldı.',
        })
      );
      return;
    }

    const targetId = product ? product.productId : cleanId;

    await deleteProduct(targetId);

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: `Ürün (${targetId}) başarıyla Firestore veritabanından silindi.`,
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, message: err?.message || 'Ürün işlemi başarısız.' }));
  }
}
