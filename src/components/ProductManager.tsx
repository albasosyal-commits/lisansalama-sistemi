import React, { useState } from 'react';
import {
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';
import { Product } from '../types';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface ProductManagerProps {
  products: Product[];
  onRefresh: () => void;
  onSelectProductForLicense: (productId: string) => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  onRefresh,
  onSelectProductForLicense,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete Modal State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Auto generate product_id slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!showAddForm || !productId || productId === generateSlug(name)) {
      setProductId(generateSlug(val));
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !productId.trim()) {
      setError('Lütfen ürün adını ve ürün kodunu giriniz.');
      return;
    }

    try {
      setLoading(true);
      await api.createProduct({
        name: name.trim(),
        productId: productId.trim().toLowerCase(),
        description: description.trim(),
        version: version.trim() || '1.0.0',
      });

      showToast('success', `"${name}" ürünü başarıyla eklendi!`);
      setName('');
      setProductId('');
      setDescription('');
      setVersion('1.0.0');
      setShowAddForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Ürün eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteModal = (prod: Product) => {
    setDeleteError(null);
    setProductToDelete(prod);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await api.deleteProduct(productToDelete.id);
      showToast('success', `"${productToDelete.name}" ürünü başarıyla silindi.`);
      setProductToDelete(null);
      onRefresh();
    } catch (err: any) {
      setDeleteError(err?.message || 'Ürün silinemedi');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#166534]'
              : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          <div className="flex items-center space-x-2.5 text-xs font-semibold">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#166534]" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#991b1b]" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-500 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Add Button */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1e293b]">Ürün & Proje Yönetimi</h2>
          <p className="text-xs text-[#64748b]">
            Lisans üretilecek yazılımlarınızı ve benzersiz ürün kodlarını (product_id) yönetin
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setError(null);
          }}
          className="px-4 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'İptal Et' : 'Yeni Ürün Ekle'}</span>
        </button>
      </div>

      {/* Add Product Form (Collapsible) */}
      {showAddForm && (
        <div className="bg-white border-2 border-[#3b82f6] rounded-xl p-5 sm:p-6 shadow-md animate-in zoom-in-95 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
            <h3 className="font-bold text-[#1e293b] text-sm">Yeni Ürün / Proje Tanımla</h3>
            <span className="text-xs text-[#64748b] font-mono">product_id</span>
          </div>

          {error && (
            <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-lg text-xs text-[#991b1b]">
              {error}
            </div>
          )}

          <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                Ürün / Yazılım Adı *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Örn: Akıllı Depo Yönetim Sistemi"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                Benzersiz Ürün Kodu (product_id) *
              </label>
              <input
                type="text"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="Örn: akilli-depo-v1"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-mono text-[#3b82f6] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
              />
              <p className="text-[10px] text-[#64748b] mt-0.5">
                Lisans payload'ına gömülecektir (Küçük harf, tire ve rakamlar)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                Varsayılan Versiyon
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748b] mb-1">
                Açıklama / Notlar
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Yazılımın kapsamı, modülleri veya platformu"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs text-[#1e293b] placeholder-slate-400 focus:border-[#3b82f6] outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end space-x-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] text-xs font-semibold rounded-lg cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                {loading ? 'Kaydediliyor...' : 'Ürünü Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Cards Grid (Geometric Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {products.map((prod) => (
          <div
            key={prod.id}
            className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:shadow hover:border-[#cbd5e1] transition flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="p-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg text-[#3b82f6]">
                  <Package className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#f8fafc] border border-[#cbd5e1] text-[10px] font-mono text-[#64748b]">
                  v{prod.version || '1.0.0'}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-[#1e293b] text-base">{prod.name}</h3>
                <div className="mt-1 inline-block px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] font-mono text-xs border border-[#bfdbfe]">
                  {prod.productId}
                </div>
              </div>

              <p className="text-xs text-[#64748b] leading-relaxed min-h-[36px]">
                {prod.description || 'Açıklama girilmemiş.'}
              </p>
            </div>

            {/* License counts and Actions */}
            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
              <div className="text-xs">
                <span className="text-[#64748b]">Üretilen: </span>
                <span className="font-bold text-[#166534]">{prod.licenseCount || 0}</span>
                {prod.activeLicenseCount !== undefined && (
                  <span className="text-[11px] text-[#64748b]">
                    {' '}
                    ({prod.activeLicenseCount} aktif)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => onSelectProductForLicense(prod.productId)}
                  className="px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1 cursor-pointer"
                  title="Bu ürün için lisans oluştur"
                >
                  <span>Lisans Üret</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`btn-delete-product-${prod.id}`}
                  onClick={() => handleOpenDeleteModal(prod)}
                  className="p-1.5 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2] rounded-lg transition cursor-pointer"
                  title="Ürünü Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <ConfirmModal
          isOpen={Boolean(productToDelete)}
          onClose={() => {
            if (!isDeleting) setProductToDelete(null);
          }}
          onConfirm={handleConfirmDeleteProduct}
          title="Ürünü Silmek Üzeresiniz"
          description="Bu ürün tanımını sistemden kaldırmak istediğinize emin misiniz?"
          itemDetails={[
            { label: 'Ürün Adı', value: productToDelete.name },
            { label: 'Ürün Kodu (product_id)', value: productToDelete.productId, isMono: true },
            { label: 'Versiyon', value: productToDelete.version || '1.0.0' },
            {
              label: 'Kayıtlı Lisans Sayısı',
              value: `${productToDelete.licenseCount || 0} adet lisans (${productToDelete.activeLicenseCount || 0} aktif)`,
            },
          ]}
          warningText="Uyarı: Ürün silindiğinde, daha önce bu ürün kodu ile üretilmiş lisanslar korunmaya devam eder ancak ürün listesinde görünmeyecektir."
          confirmText="Evet, Ürünü Sil"
          cancelText="Vazgeç"
          variant="danger"
          isLoading={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
};
