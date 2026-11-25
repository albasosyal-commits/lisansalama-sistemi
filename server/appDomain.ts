// Sosyalritim mobil uygulaması için ortak, saf (yan etkisiz) yardımcılar.
// Hem sunucu (api/*.ts, server.ts) hem tarayıcı (src/) tarafından import edilir —
// bu yüzden burada hiçbir Node/Firebase bağımlılığı OLMAMALI.

/**
 * Kurum (site) adresini normalleştirir:
 *   " https://www.Akcaysk.Sosyalritim.com.tr/login " -> "akcaysk.sosyalritim.com.tr"
 * Şema, "www.", yol/sorgu/parça, port ve kullanıcı bilgisi atılır; küçük harfe çevrilir.
 * Boş ya da geçersiz girişte null döner (en az bir nokta, yalnız [a-z0-9.-]).
 */
export function normalizeAppDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;

  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // şema (https://)
  s = s.replace(/^\/\//, ''); // şemasız "//host"
  s = s.split(/[/?#]/)[0]; // yol, sorgu, parça
  s = s.slice(s.lastIndexOf('@') + 1); // kullanıcı:şifre@
  s = s.replace(/:\d*$/, ''); // port
  s = s.replace(/\.$/, ''); // sondaki nokta (FQDN)
  if (s.startsWith('www.')) s = s.slice(4);

  if (!s || s.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  if (!s.includes('.')) return null;
  const labels = s.split('.');
  if (labels.some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return null;
  return s;
}

export interface AppClubLicense {
  customer: string;
  product_id: string;
  status: string;
  expires_at: string;
  created_at?: string;
  app_domain?: string | null;
}

export interface AppClubProduct {
  productId: string;
  id?: string;
  mobile_app?: boolean;
}

export interface ApprovedClub {
  name: string;
  domain: string;
}

/**
 * Mobil uygulamada listelenecek onaylı kulüpler. Bir lisans şu koşulların hepsini
 * sağlıyorsa onaylıdır: ürünü "mobil uygulamada kullanılır" işaretli, durumu 'active',
 * bitiş tarihi gelecekte ve geçerli bir kurum adresi (app_domain) var.
 * Aynı adres birden fazla lisansta varsa en son oluşturulan lisans kazanır.
 */
export function selectApprovedClubs(
  licenses: AppClubLicense[],
  products: AppClubProduct[],
  now: number = Date.now()
): ApprovedClub[] {
  const mobileProducts = new Set<string>();
  for (const p of products) {
    if (p && p.mobile_app === true) {
      if (p.productId) mobileProducts.add(String(p.productId).trim().toLowerCase());
      if (p.id) mobileProducts.add(String(p.id).trim().toLowerCase());
    }
  }

  const byDomain = new Map<string, { club: ApprovedClub; createdAt: number }>();
  for (const lic of licenses) {
    if (!lic || lic.status !== 'active') continue;
    if (!mobileProducts.has(String(lic.product_id || '').trim().toLowerCase())) continue;
    const exp = new Date(lic.expires_at).getTime();
    if (!Number.isFinite(exp) || exp <= now) continue;
    const domain = normalizeAppDomain(lic.app_domain);
    if (!domain) continue;

    const createdAt = new Date(lic.created_at || 0).getTime() || 0;
    const prev = byDomain.get(domain);
    if (!prev || createdAt > prev.createdAt) {
      byDomain.set(domain, {
        club: { name: String(lic.customer || '').trim() || domain, domain },
        createdAt,
      });
    }
  }

  return Array.from(byDomain.values())
    .map((v) => v.club)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
