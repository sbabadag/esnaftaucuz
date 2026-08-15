#!/usr/bin/env node

/**
 * SSG — her esnaf dükkanı için statik HTML üretir.
 * `generate-product-pages.mjs` sonrasında çalışır; dist/s/{merchantId}/index.html yazar.
 * Googlebot, dükkan bilgilerini (ad, adres, ürünler, fiyatlar) JS render beklemeden alır.
 *
 * Çalışma: node scripts/generate-shop-pages.mjs
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (process.env veya .env)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const DIST_DIR = join(projectRoot, 'dist');

function loadEnvFile() {
  const envVars = {};
  for (const envFile of ['.env.production', '.env']) {
    try {
      const content = readFileSync(join(projectRoot, envFile), 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!envVars[key]) envVars[key] = value;
        }
      }
    } catch {
      // dosya yok
    }
  }
  return envVars;
}

const envFileVars = loadEnvFile();
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || envFileVars.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || envFileVars.VITE_SUPABASE_ANON_KEY || '';

function resolveSiteBase() {
  const explicit = String(process.env.SITE_URL || envFileVars.SITE_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  try {
    const cname = readFileSync(join(projectRoot, 'public', 'CNAME'), 'utf-8').trim();
    if (cname) return `https://${cname}`;
  } catch {
    // CNAME yok
  }
  return 'https://www.esnaftaucuz.com';
}

const SITE_BASE = resolveSiteBase();

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstPublicImage(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = String(item || '').trim();
      if (/^https?:\/\//i.test(s)) return s;
    }
    return '';
  }
  const s = String(value || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

/** Türkçe karakterleri sadeleştirir: "Konya Meram" → "konya-meram" */
function slugify(value) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return String(value || '')
    .toLocaleLowerCase('tr')
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function fetchAll(path) {
  const resp = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${path}`);
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function buildShopHtml(shop, items, merchantCoords, shopReviews) {
  const name = escapeHtml(shop.name);
  const pref = (shop.preferences && typeof shop.preferences === 'object') ? shop.preferences : {};
  const loc = (shop.location && typeof shop.location === 'object') ? shop.location : {};
  const city = escapeHtml(loc.city || '');
  const district = escapeHtml(loc.district || '');
  const descriptionText = String(pref.shopDescription || '');
  // Öncelik preferences.shopAddress; güncellenmiş users.shop_address'e düş (DB düzeltmeleri oraya yazılıyor)
  const addressText = String(pref.shopAddress || shop.shop_address || '');
  const hours = String(pref.openingHours || '');
  const phone = String(pref.phone || '');
  const logo = firstPublicImage(pref.shopLogo) || firstPublicImage(shop.avatar);
  const canonical = `${SITE_BASE}/s/${shop.id}`;
  const metaDescription = `${name} — ${items.length} ürün ve güncel fiyatlar${city ? ` (${city}${district ? ', ' + district : ''})` : ''}. ${escapeHtml(descriptionText)}`.trim();

  const productRows = items
    .slice(0, 60)
    .map((item) => {
      const price = Number(item.price);
      const priceText = Number.isFinite(price) && price > 0 ? `${price.toFixed(2)} ₺` : '';
      const unit = item.unit ? ` / ${escapeHtml(item.unit)}` : '';
      return `<li style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;">
        <span style="font-size:16px;">${escapeHtml(item.product_name)}${unit ? `<span style="color:#666;font-size:14px;">${unit}</span>` : ''}</span>
        <strong style="font-size:16px;color:#166534;">${priceText || '—'}</strong>
      </li>`;
    })
    .join('\n');

  // Shop koordinatları — öncelik sırası:
  // 1) users.location.coordinates nesnesi ({lat,lng})
  // 2) prices.user_id → locations.coordinates POINT stringi (merchantCoords)
  // 3) shop.coordinates POINT stringi
  let geoLat = null;
  let geoLng = null;
  const locCoords = loc.coordinates && typeof loc.coordinates === 'object' ? loc.coordinates : null;
  if (
    locCoords &&
    locCoords.lat != null &&
    locCoords.lng != null &&
    Number.isFinite(Number(locCoords.lat)) &&
    Number.isFinite(Number(locCoords.lng))
  ) {
    geoLat = Number(locCoords.lat);
    geoLng = Number(locCoords.lng);
  }
  if ((geoLat === null || geoLng === null) && merchantCoords) {
    const mc = merchantCoords.get(shop.id);
    if (mc && Number.isFinite(mc.lat) && Number.isFinite(mc.lng)) {
      geoLat = mc.lat;
      geoLng = mc.lng;
    }
  }
  if (geoLat === null || geoLng === null) {
    const coordRaw = String(shop.coordinates || '');
    const coordMatch = coordRaw.match(/\(([^,]+),([^)]+)\)/);
    if (coordMatch) {
      const lng = parseFloat(coordMatch[1]);
      const lat = parseFloat(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        geoLat = lat;
        geoLng = lng;
      }
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    url: canonical,
    image: logo || undefined,
    description: descriptionText || undefined,
    ...(addressText || city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(addressText ? { streetAddress: addressText } : {}),
            ...(city ? { addressLocality: city } : {}),
            ...(district ? { addressRegion: district } : {}),
            ...(city || addressText ? { addressCountry: 'TR' } : {}),
          },
        }
      : {}),
    ...(geoLat !== null && geoLng !== null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: geoLat,
            longitude: geoLng,
          },
        }
      : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(hours ? { openingHours: hours } : {}),
    priceRange: items.length ? '₺' : undefined,
    // Gerçek kullanıcı değerlendirmeleri (shop_reviews) → Review rich snippet
    ...(shopReviews && shopReviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(
              (shopReviews.reduce((s, r) => s + Number(r.rating || 0), 0) / shopReviews.length).toFixed(1)
            ),
            reviewCount: shopReviews.length,
            bestRating: 5,
            worstRating: 1,
          },
          review: shopReviews.slice(0, 3).map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.user_name || 'Kullanıcı' },
            datePublished: r.created_at || undefined,
            reviewRating: { '@type': 'Rating', ratingValue: Number(r.rating), bestRating: 5, worstRating: 1 },
            ...(r.comment ? { description: String(r.comment).slice(0, 500) } : {}),
          })),
        }
      : {}),
  };
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${metaDescription}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${name} — ürünler ve fiyatlar" />
  <meta property="og:description" content="${metaDescription}" />
  <meta property="og:url" content="${canonical}" />
  ${logo ? `<meta property="og:image" content="${escapeHtml(logo)}" />` : ''}
  <meta name="twitter:card" content="summary" />
  <title>${name} — ürünler ve fiyatlar</title>
  <script type="application/ld+json">${jsonLdString}</script>
  <style>
    body { max-width: 720px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, sans-serif; color: #111; }
    h1 { font-size: 28px; margin: 12px 0 4px; }
    .meta { color: #555; font-size: 14px; margin-bottom: 16px; }
    .meta div { margin: 2px 0; }
    .desc { background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin: 12px 0; font-size: 14px; color: #333; }
    ul { list-style: none; padding: 0; }
    a.cta { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #16a34a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .play { text-align: center; margin-top: 24px; padding: 20px 16px; background: #f8fafc; border-radius: 10px; }
    .play-text { font-size: 14px; color: #333; margin-bottom: 10px; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 13px; }
  </style>
</head>
<body>
  ${logo ? `<img src="${escapeHtml(logo)}" alt="${name}" style="max-width:96px;height:auto;border-radius:10px;" />` : ''}
  <h1>${name}</h1>
  <div class="meta">
    ${city ? `<div>📍 ${city}${district ? ` / ${district}` : ''}</div>` : ''}
    ${addressText ? `<div>${escapeHtml(addressText)}</div>` : ''}
    ${hours ? `<div>🕐 ${escapeHtml(hours)}</div>` : ''}
    ${phone ? `<div>📞 ${escapeHtml(phone)}</div>` : ''}
    ${city ? `<div>🔎 <a href="${SITE_BASE}/${slugify(city)}${district ? '-' + slugify(district) : ''}/" style="color:#166534;">${city}${district ? ' ' + district : ''} bölgesindeki diğer fiyatlar</a></div>` : ''}
  </div>
  ${descriptionText ? `<div class="desc">${escapeHtml(descriptionText)}</div>` : ''}

  <h2 style="font-size:18px;margin-top:20px;">Ürünler ve fiyatlar</h2>
  ${items.length === 0 ? '<p style="color:#666;">Bu dükkanda henüz ürün kaydı yok.</p>' : `<ul>${productRows}</ul>`}

  <a class="cta" id="app-cta" href="/s/${shop.id}">📱 Uygulamada aç</a>
  <script>
    (function () {
      // Android'de App Link native uygulamayı açar; diğer platformlarda (web/masaüstü)
      // web uygulamasının dükkan sayfasına götür.
      if (!/Android/i.test(navigator.userAgent)) {
        var el = document.getElementById('app-cta');
        if (el) el.href = '/app/merchant-shop/${shop.id}';
      }
    })();
  </script>

  <div class="play">
    <div class="play-text">Güncel fiyatları kaçırmayın — uygulamayı Google Play'den indirin:</div>
    <a href="https://play.google.com/store/apps/details?id=com.esnaftaucuz.app" target="_blank" rel="noopener noreferrer">
      <img src="https://play.google.com/intl/en_us/badges/static/images/badges/tr_badge_web_generic.png" alt="Google Play'den indir" style="height:52px;width:auto;" />
    </a>
  </div>
  <footer>Fiyatlar esnaf topluluğu tarafından paylaşılmaktadır. Güncel fiyatlar için esnaftaucuz uygulamasını kullanın.</footer>
</body>
</html>`;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  Supabase env eksik — dükkan SSG atlanıyor.');
    return;
  }

  console.log('🏪 SSG: dükkan sayfaları üretiliyor...');

  const [merchants, merchantProducts, products, locations, prices, reviews] = await Promise.all([
    fetchAll('/rest/v1/users?select=id,name,avatar,location,preferences,shop_address&is_merchant=eq.true&limit=2000'),
    fetchAll('/rest/v1/merchant_products?select=merchant_id,product_id,price,unit,images,is_active,location_id&limit=20000'),
    fetchAll('/rest/v1/products?select=id,name&limit=5000'),
    fetchAll('/rest/v1/locations?select=id,coordinates&limit=5000'),
    fetchAll('/rest/v1/prices?select=user_id,location_id&limit=20000'),
    // Tablo henüz yoksa (migration 053 uygulanmamışsa) SSG çökmesin — boş diziyle devam
    fetchAll('/rest/v1/shop_reviews?select=shop_id,rating,comment,created_at,user:users!shop_reviews_user_id_fkey(name)&limit=20000').catch(() => []),
  ]);

  const reviewsByMerchant = new Map();
  for (const rv of reviews) {
    if (!rv.shop_id) continue;
    if (!reviewsByMerchant.has(rv.shop_id)) reviewsByMerchant.set(rv.shop_id, []);
    reviewsByMerchant.get(rv.shop_id).push({
      rating: rv.rating,
      comment: rv.comment,
      created_at: rv.created_at,
      user_name: rv.user?.name || null,
    });
  }

  // merchant → ilk bağlı lokasyon koordinatı (merchant_products.location_id çoğunlukla null;
  // gerçek bağlantı prices.user_id → prices.location_id üzerinden)
  const coordsByMerchant = new Map();
  const locRows = new Map(locations.map((l) => [l.id, l]));
  for (const p of prices) {
    if (!p.user_id || coordsByMerchant.has(p.user_id)) continue;
    const lrow = locRows.get(p.location_id);
    if (!lrow) continue;
    const m = String(lrow.coordinates || '').match(/\(([^,]+),([^)]+)\)/);
    if (m) {
      const lng = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coordsByMerchant.set(p.user_id, { lat, lng });
      }
    }
  }

  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  const itemsByMerchant = new Map();
  for (const mp of merchantProducts) {
    if (!mp.merchant_id || !mp.product_id) continue;
    const num = Number(mp.price);
    if (mp.is_active === false) continue;
    if (!Number.isFinite(num) || num <= 0) continue;
    const pname = productNameById.get(mp.product_id);
    if (!pname) continue;
    if (!itemsByMerchant.has(mp.merchant_id)) itemsByMerchant.set(mp.merchant_id, []);
    itemsByMerchant.get(mp.merchant_id).push({ ...mp, product_name: pname });
  }
  for (const list of itemsByMerchant.values()) {
    list.sort((a, b) => String(a.product_name).localeCompare(String(b.product_name), 'tr'));
  }

  let written = 0;
  for (const shop of merchants) {
    if (!shop || !shop.id || !shop.name) continue;
    const items = itemsByMerchant.get(shop.id) || [];
    const html = buildShopHtml(shop, items, coordsByMerchant, reviewsByMerchant.get(shop.id) || []);
    const dir = join(DIST_DIR, 's', shop.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
    written++;
  }

  console.log(`✅ Dükkan SSG tamamlandı: ${written} dükkan sayfası → dist/s/{id}/index.html`);
}

main().catch((err) => {
  console.error('❌ Dükkan sayfaları üretilemedi:', err);
  process.exit(1);
});
