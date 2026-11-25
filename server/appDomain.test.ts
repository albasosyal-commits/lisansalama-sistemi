import { describe, expect, test } from 'vitest';
import { normalizeAppDomain, selectApprovedClubs } from './appDomain';

describe('normalizeAppDomain', () => {
  test('şema, www, yol ve büyük harfleri temizler', () => {
    expect(normalizeAppDomain(' https://www.Akcaysk.Sosyalritim.com.tr/login ')).toBe(
      'akcaysk.sosyalritim.com.tr'
    );
  });
  test('düz adresi olduğu gibi bırakır', () => {
    expect(normalizeAppDomain('akcaysk.sosyalritim.com.tr')).toBe('akcaysk.sosyalritim.com.tr');
  });
  test('port, sorgu ve parçayı atar', () => {
    expect(normalizeAppDomain('http://club.example.com:8080/a?b=1#c')).toBe('club.example.com');
    expect(normalizeAppDomain('club.example.com?x=1')).toBe('club.example.com');
  });
  test('boş / geçersiz girişte null döner', () => {
    expect(normalizeAppDomain('')).toBeNull();
    expect(normalizeAppDomain('   ')).toBeNull();
    expect(normalizeAppDomain(null)).toBeNull();
    expect(normalizeAppDomain(undefined)).toBeNull();
    expect(normalizeAppDomain(42)).toBeNull();
    expect(normalizeAppDomain('localhost')).toBeNull();
    expect(normalizeAppDomain('kötü.com')).toBeNull();
    expect(normalizeAppDomain('a b.com')).toBeNull();
    expect(normalizeAppDomain('a..com')).toBeNull();
    expect(normalizeAppDomain('-a.com')).toBeNull();
    expect(normalizeAppDomain('https://')).toBeNull();
  });
});

describe('selectApprovedClubs', () => {
  const now = new Date('2026-11-25T00:00:00Z').getTime();
  const future = '2027-11-25T00:00:00Z';
  const past = '2026-01-01T00:00:00Z';
  const products = [
    { productId: 'sporclub', mobile_app: true },
    { productId: 'muhasebe', mobile_app: false },
    { productId: 'eski' },
  ];
  const base = { product_id: 'sporclub', status: 'active', expires_at: future, created_at: '2026-10-01T00:00:00Z' };

  test('yalnız tüm koşulları sağlayan lisansları döner', () => {
    const clubs = selectApprovedClubs(
      [
        { ...base, customer: 'Akçay SK', app_domain: 'akcaysk.sosyalritim.com.tr' },
        { ...base, customer: 'Süresi dolmuş', app_domain: 'a.example.com', expires_at: past },
        { ...base, customer: 'İptal', app_domain: 'b.example.com', status: 'revoked' },
        { ...base, customer: 'Dondurulmuş', app_domain: 'c.example.com', status: 'paused' },
        { ...base, customer: 'Adressiz', app_domain: null },
        { ...base, customer: 'Mobil değil', app_domain: 'd.example.com', product_id: 'muhasebe' },
        { ...base, customer: 'İşaretsiz ürün', app_domain: 'e.example.com', product_id: 'eski' },
      ],
      products,
      now
    );
    expect(clubs).toEqual([{ name: 'Akçay SK', domain: 'akcaysk.sosyalritim.com.tr' }]);
  });

  test('aynı adreste en son oluşturulan lisans kazanır', () => {
    const clubs = selectApprovedClubs(
      [
        { ...base, customer: 'Eski Ad', app_domain: 'x.example.com', created_at: '2026-01-01T00:00:00Z' },
        { ...base, customer: 'Yeni Ad', app_domain: 'https://www.X.example.com/', created_at: '2026-06-01T00:00:00Z' },
      ],
      products,
      now
    );
    expect(clubs).toEqual([{ name: 'Yeni Ad', domain: 'x.example.com' }]);
  });
});
