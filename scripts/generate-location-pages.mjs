#!/usr/bin/env node

/**
 * SSG — il/ilçe bazlı fiyat sayfaları üretir.
 * `generate-shop-pages.mjs` sonrasında çalışır; dist/<slug>/index.html yazar.
 * Amaç: "Konya en ucuz market", "Adrasan balık fiyatları" gibi yerel aramalarda
 * Google'da çıkmak (SEO yüzeyini il/ilçe düzeyine genişletir).
 *
 * Sayfalar:
 *   /<city-slug>/            → şehir: ilçeler + şehrin en ucuz ürünleri + dükkanlar
 *   /<city>-<district-slug>/ → ilçe: ilçenin en ucuz ürünleri + dükkanlar
 *   /bolgeler/               → tüm şehir/ilçe dizini
 *
 * Çalışma: node scripts/generate-location-pages.mjs
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

/** Türkçe karakterleri sadeleştirir: "Konya Meram" → "konya-meram" */
export function slugify(value) {
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

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  const s = n.toFixed(2);
  return `${s.replace(/\./g, ',').replace(/,00$/, '')} ₺`;
}

const PAGE_HEAD = (title, metaDescription, canonical, jsonLd) => `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(metaDescription)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(metaDescription)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
  header { background: #166534; color: #fff; padding: 14px 16px; }
  header a { color: #fff; text-decoration: none; font-weight: 600; font-size: 18px; }
  main { max-width: 800px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  h2 { font-size: 18px; margin: 24px 0 10px; color: #166534; }
  .crumb { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
  .crumb a { color: #166534; }
  .item { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
  .item-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .item a { color: #111827; text-decoration: none; font-weight: 500; }
  .price { color: #166534; font-weight: 700; white-space: nowrap; }
  .muted { color: #6b7280; font-size: 13px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { background: #fff; border: 1px solid #d1d5db; border-radius: 999px; padding: 6px 12px; font-size: 14px; text-decoration: none; color: #111827; }
  .chip:hover { border-color: #166534; color: #166534; }
  footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
  footer a { color: #166534; }
</style>
</head>
<body>
<header><a href="${SITE_BASE}/">esnaftaucuz</a></header>
<main>`;

const PAGE_FOOT = `</main>
<footer><a href="${SITE_BASE}/">esnaftaucuz.com</a> — mahallendeki esnaf fiyatları</footer>
</body>
</html>`;

function breadcrumbHtml(items) {
  return `<div class="crumb">${items
    .map((c, i) => (c.href ? `<a href="${c.href}">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)))
    .join(' › ')}</div>`;
}

function productListHtml(rows, title) {
  if (!rows.length) return '';
  return `<h2>${escapeHtml(title)}</h2>
${rows
  .map(
    (r) => `<div class="item"><div class="item-row">
  <span><a href="${SITE_BASE}/p/${r.product_id}">${escapeHtml(r.product_name)}</a><span class="muted">${r.category ? ' · ' + escapeHtml(r.category) : ''}</span></span>
  <span class="price">${r.priceText}</span>
</div><div class="muted">${r.shopLinks ? 'Fiyat veren: ' + r.shopLinks : ''}</div></div>`
  )
  .join('\n')}`;
}

function shopListHtml(shops) {
  if (!shops.length) return '';
  return `<h2>Bu bölgedeki dükkanlar</h2>
${shops
  .map(
    (s) => `<div class="item"><div class="item-row">
  <span><a href="${SITE_BASE}/s/${s.id}">${escapeHtml(s.name)}</a><span class="muted">${s.address ? ' · ' + escapeHtml(s.address) : ''}</span></span>
  <span class="muted">${s.productCount ? s.productCount + ' ürün' : ''}</span>
</div></div>`
  )
  .join('\n')}`;
}

async function main() {
  console.log('📍 İl/ilçe sayfaları üretiliyor...');

  const [locations, prices, products, merchants] = await Promise.all([
    fetchAll('/rest/v1/locations?select=id,city,district,address&limit=5000'),
    fetchAll('/rest/v1/prices?select=id,product_id,location_id,user_id,price,is_verified&limit=20000'),
    fetchAll('/rest/v1/products?select=id,name,category,image&limit=5000'),
    fetchAll('/rest/v1/users?select=id,name,shop_name,avatar,preferences,location&is_merchant=eq.true&limit=2000'),
  ]);

  const locById = new Map(locations.map((l) => [l.id, l]));
  const prodById = new Map(products.map((p) => [p.id, p]));

  // Bölge sözlüğü: normalize edilmiş (küçük harf) anahtarlarla grupla
  const keyOf = (s) => String(s || '').toLocaleLowerCase('tr').trim();
  const districtByKey = new Map(); // "konya|meram" → { city, district, locations: Set }
  const cityKeys = new Set();
  for (const l of locations) {
    const city = keyOf(l.city);
    const district = keyOf(l.district);
    if (!city) continue;
    cityKeys.add(city);
    const dk = district && district !== city ? district : '';
    const key = `${city}|${dk}`;
    if (!districtByKey.has(key)) {
      districtByKey.set(key, { city: l.city, district: l.district, locationIds: new Set() });
    }
    districtByKey.get(key).locationIds.add(l.id);
  }

  // Dükkan → bölge eşlemesi (users.location {city,district})
  const shopRegionKey = (m) => {
    const loc = (m.location && typeof m.location === 'object') ? m.location : {};
    const city = keyOf(loc.city);
    const district = keyOf(loc.district);
    if (!city) return null;
    return district && district !== city ? `${city}|${district}` : `${city}|`;
  };

  // Ürün başına bölge içindeki en düşük fiyat + fiyat veren dükkan linkleri
  const priceByRegionProduct = new Map(); // "konya|meram|productId" → { min, shopIds: Set }
  for (const p of prices) {
    const loc = locById.get(p.location_id);
    if (!loc) continue;
    const city = keyOf(loc.city);
    if (!city) continue;
    const district = keyOf(loc.district);
    const dk = district && district !== city ? district : '';
    const price = Number(p.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const key = `${city}|${dk}|${p.product_id}`;
    const entry = priceByRegionProduct.get(key) || { min: Infinity, shopIds: new Set() };
    if (price < entry.min) entry.min = price;
    if (p.user_id) entry.shopIds.add(p.user_id);
    priceByRegionProduct.set(key, entry);
  }

  // Dükkan listesi (isim + adres + ürün sayısı)
  const shopNameById = new Map();
  for (const m of merchants) {
    const pref = (m.preferences && typeof m.preferences === 'object') ? m.preferences : {};
    const loc = (m.location && typeof m.location === 'object') ? m.location : {};
    shopNameById.set(m.id, {
      id: m.id,
      name: m.shop_name || m.name || 'Dükkan',
      address: String(pref.shopAddress || m.shop_address || '').trim(),
      regionKey: shopRegionKey(m),
      productCount: 0,
    });
  }

  // Dükkanların ürün sayısı: merchant_products çekmeden, prices.user_id üzerinden tahmin etme —
  // bunun yerine shop sayfalarındaki linkler yeterli; ürün sayısı bilinmeyen kalır (0).

  const regionKeyFromLocKey = (locKey) => {
    const [city, district] = locKey.split('|');
    return `${city}|${district || ''}`;
  };

  // Her bölge için en ucuz ürünler (min fiyatla, en fazla 24).
  // regionKey "konya|meram" ise tam eşleşme; "konya|" (şehir) ise tüm ilçeleri birleştir.
  function cheapestForRegion(regionKey) {
    const isCity = regionKey.endsWith('|');
    const aggregated = new Map(); // productId → { min, shopIds:Set }
    for (const [pkey, entry] of priceByRegionProduct) {
      const matches = isCity ? pkey.startsWith(regionKey) : regionKeyFromLocKey(pkey) === regionKey;
      if (!matches) continue;
      const rest = pkey.slice(regionKey.length);
      const productId = isCity ? rest.split('|')[1] : rest.slice(1);
      if (!productId) continue;
      const agg = aggregated.get(productId) || { min: Infinity, shopIds: new Set() };
      if (entry.min < agg.min) agg.min = entry.min;
      for (const sid of entry.shopIds) agg.shopIds.add(sid);
      aggregated.set(productId, agg);
    }
    const rows = [];
    for (const [productId, entry] of aggregated) {
      const prod = prodById.get(productId);
      if (!prod) continue;
      const shopLinks = [...entry.shopIds]
        .slice(0, 3)
        .map((sid) => {
          const s = shopNameById.get(sid);
          return s ? `<a href="${SITE_BASE}/s/${sid}">${escapeHtml(s.name)}</a>` : '';
        })
        .filter(Boolean)
        .join(', ');
      rows.push({
        product_id: productId,
        product_name: prod.name,
        category: prod.category || '',
        priceText: formatPrice(entry.min),
        shopLinks,
        min: entry.min,
        count: entry.shopIds.size,
      });
    }
    rows.sort((a, b) => b.count - a.count || a.min - b.min);
    return rows.slice(0, 24);
  }

  // Slug havuzu (çakışma koruması)
  const usedSlugs = new Set(['bolgeler', 'p', 's', 'app', 'assets', 'login', 'onboarding', 'about', 'privacy-policy', 'terms-of-service', 'delivery-return-policy', 'distance-sales-agreement']);
  const slugFor = (base) => {
    let slug = slugify(base);
    if (!slug || usedSlugs.has(slug)) {
      let i = 2;
      while (usedSlugs.has(`${slug}-${i}`)) i += 1;
      slug = `${slug}-${i}`;
    }
    usedSlugs.add(slug);
    return slug;
  };

  // Şehirler → ilçeler
  const districtsOfCity = (cityKey) => {
    const out = [];
    for (const [dk, region] of districtByKey) {
      const [c] = dk.split('|');
      if (c === cityKey) out.push({ regionKey: dk, district: region.district });
    }
    return out;
  };

  const pageCounts = { city: 0, district: 0 };
  const dirIndex = [];

  // Şehir path'lerini önce rezerve et (ilçe path'leri buna dayanır)
  const cityPathByKey = new Map();
  const cityNameByKey = new Map();
  for (const cityKey of [...new Set([...districtByKey.keys()].map((k) => k.split('|')[0]))].sort()) {
    const cityName =
      districtByKey.get(`${cityKey}|`)?.city ||
      [...districtByKey.values()].find((r) => keyOf(r.city) === cityKey)?.city ||
      cityKey;
    cityNameByKey.set(cityKey, cityName);
    cityPathByKey.set(cityKey, slugFor(cityName));
  }

  // İlçe slug havuzu şehir başına (farklı şehirlerde aynı isimli ilçeler çakışmasın)
  const districtSlugPools = new Map();
  const districtPathByRegionKey = new Map(); // memoize — şehir çipleri ile ilçe sayfaları aynı path'i kullansın
  const districtPathOf = (regionKey, region) => {
    const cached = districtPathByRegionKey.get(regionKey);
    if (cached) return cached;
    const [cityKey] = regionKey.split('|');
    const cityPath = cityPathByKey.get(cityKey) || slugify(cityKey);
    const pool = districtSlugPools.get(cityPath) || new Set();
    let dslug = slugify(region.district);
    if (!dslug || pool.has(dslug)) {
      let i = 2;
      while (pool.has(`${dslug}-${i}`)) i += 1;
      dslug = `${dslug}-${i}`;
    }
    pool.add(dslug);
    districtSlugPools.set(cityPath, pool);
    const path = `${cityPath}-${dslug}`;
    districtPathByRegionKey.set(regionKey, path);
    return path;
  };

  const writeRegionPage = (regionKey, region, hasDistrict) => {
    const [cityKey] = regionKey.split('|');
    const cityName = cityNameByKey.get(cityKey) || region.city;

    const title = hasDistrict
      ? `${region.district} Esnaf Fiyatları — En Ucuz Ürünler ve Dükkanlar`
      : `${cityName} Esnaf Fiyatları — En Ucuz Ürünler ve Dükkanlar`;
    const metaDescription = hasDistrict
      ? `${region.district} (${cityName}) bölgesindeki esnaf dükkanlarının güncel fiyatları ve en ucuz ürünler. Mahallende fiyat karşılaştır.`
      : `${cityName} bölgesindeki esnaf dükkanlarının güncel fiyatları ve en ucuz ürünler. Mahallende fiyat karşılaştır.`;

    const cheapest = cheapestForRegion(regionKey);
    const shopsHere = [...shopNameById.values()].filter((s) =>
      hasDistrict ? s.regionKey === regionKey : (s.regionKey || '').startsWith(regionKey)
    );

    const cityPath = cityPathByKey.get(cityKey) || slugify(cityName);
    const crumb = hasDistrict
      ? breadcrumbHtml([
          { name: 'Bölgeler', href: `${SITE_BASE}/bolgeler/` },
          { name: cityName, href: `${SITE_BASE}/${cityPath}/` },
          { name: region.district },
        ])
      : breadcrumbHtml([
          { name: 'Bölgeler', href: `${SITE_BASE}/bolgeler/` },
          { name: cityName },
        ]);

    let districtChips = '';
    if (!hasDistrict) {
      const subs = districtsOfCity(cityKey);
      if (subs.length) {
        districtChips = `<div class="chips">${subs
          .map(
            (s) =>
              `<a class="chip" href="${SITE_BASE}/${districtPathOf(s.regionKey, { district: s.district })}/">${escapeHtml(s.district)}</a>`
          )
          .join('')}</div>`;
      }
    }

    const dirPath = hasDistrict ? districtPathOf(regionKey, region) : cityPath;
    const canonical = `${SITE_BASE}/${dirPath}/`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      url: canonical,
      description: metaDescription,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Bölgeler', item: `${SITE_BASE}/bolgeler/` },
          ...(hasDistrict
            ? [
                { '@type': 'ListItem', position: 2, name: cityName, item: `${SITE_BASE}/${cityPath}/` },
                { '@type': 'ListItem', position: 3, name: region.district },
              ]
            : [{ '@type': 'ListItem', position: 2, name: cityName }]),
        ],
      },
    };
    if (cheapest.length) {
      jsonLd.mainEntity = {
        '@type': 'ItemList',
        numberOfItems: cheapest.length,
        itemListElement: cheapest.slice(0, 20).map((r, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: r.product_name,
            url: `${SITE_BASE}/p/${r.product_id}`,
            ...(r.category ? { category: r.category } : {}),
            offers: {
              '@type': 'Offer',
              priceCurrency: 'TRY',
              price: String(r.min),
              availability: 'https://schema.org/InStock',
              url: `${SITE_BASE}/p/${r.product_id}`,
            },
          },
        })),
      };
    }

    const body = `${PAGE_HEAD(title, metaDescription, canonical, jsonLd)}
${crumb}
<h1>${escapeHtml(title.replace(' Esnaf Fiyatları — En Ucuz Ürünler ve Dükkanlar', ''))}</h1>
${districtChips}
${productListHtml(cheapest, hasDistrict ? `${region.district} bölgesinde en ucuz ürünler` : `${cityName} bölgesinde en ucuz ürünler`)}
${shopListHtml(shopsHere)}
${PAGE_FOOT}`;

    const outDir = join(DIST_DIR, dirPath);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), body, 'utf-8');
    pageCounts[hasDistrict ? 'district' : 'city'] += 1;
    dirIndex.push({
      name: hasDistrict ? `${region.district} (${cityName})` : cityName,
      path: dirPath,
      isDistrict: hasDistrict,
    });
  };

  // 1) Şehir sayfaları (tüm ilçeleri birleştirir)
  for (const [cityKey, cityName] of cityNameByKey) {
    writeRegionPage(`${cityKey}|`, { city: cityName, district: '' }, false);
  }
  // 2) İlçe sayfaları
  for (const [regionKey, region] of districtByKey) {
    writeRegionPage(regionKey, region, true);
  }

  // Bölgeler dizin sayfası
  const citiesSorted = [...new Set([...districtByKey.keys()].map((k) => k.split('|')[0]))].sort();
  const indexHtml = `${PAGE_HEAD(
    'Bölgelere Göre Esnaf Fiyatları',
    'Şehir ve ilçelere göre esnaf fiyatları: en ucuz ürünler ve dükkan listeleri. Mahallende fiyat karşılaştır.',
    `${SITE_BASE}/bolgeler/`,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Bölgelere Göre Esnaf Fiyatları',
      url: `${SITE_BASE}/bolgeler/`,
      description: 'Şehir ve ilçelere göre esnaf fiyatları.',
    }
  )}
<h1>Bölgelere Göre Esnaf Fiyatları</h1>
<p class="muted">Şehir ve ilçe bazında güncel esnaf fiyatları.</p>
${citiesSorted
  .map((cityKey) => {
    const cityName = cityNameByKey.get(cityKey) || cityKey;
    const cityPath = cityPathByKey.get(cityKey) || slugify(cityKey);
    const subs = districtsOfCity(cityKey);
    return `<h2>${escapeHtml(cityName)}</h2><div class="chips">${
      subs.length
        ? subs
            .map(
              (s) =>
                `<a class="chip" href="${SITE_BASE}/${districtPathOf(s.regionKey, { district: s.district })}/">${escapeHtml(s.district)}</a>`
            )
            .join('')
        : `<a class="chip" href="${SITE_BASE}/${cityPath}/">${escapeHtml(cityName)}</a>`
    }</div>`;
  })
  .join('\n')}
${PAGE_FOOT}`;
  const indexDir = join(DIST_DIR, 'bolgeler');
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(join(indexDir, 'index.html'), indexHtml, 'utf-8');

  console.log(`✅ İl/ilçe sayfaları yazıldı: ${pageCounts.city} şehir, ${pageCounts.district} ilçe (+ /bolgeler/ dizini)`);
}

main().catch((err) => {
  console.error('❌ İl/ilçe sayfaları üretilemedi:', err);
  process.exit(1);
});
