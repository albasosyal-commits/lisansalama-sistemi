import type { IncomingMessage, ServerResponse } from 'http';
import { getProducts, deleteProduct } from '../server/firebaseAdmin.js';

// DELETE /api/products/:id (vercel.json rewrite) -> /api/product-item?id=:id
export default async function handler(
  req: IncomingMessage & { query?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'DELETE') {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
    return;
  }

  try {
    const id = req.query?.id as string;
    const cleanId = id.trim().toLowerCase();
    const products = await getProducts();
    const product = products.find((p) => p.id === cleanId || p.productId === cleanId);
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
    res.end(JSON.stringify({ success: false, message: err?.message || 'Ürün silinemedi.' }));
  }
}
