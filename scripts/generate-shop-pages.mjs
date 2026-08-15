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

function buildShopHtml(shop, items) {
  const name = escapeHtml(shop.name);
  const pref = (shop.preferences && typeof shop.preferences === 'object') ? shop.preferences : {};
  const loc = (shop.location && typeof shop.location === 'object') ? shop.location : {};
  const city = escapeHtml(loc.city || '');
  const district = escapeHtml(loc.district || '');
  const descriptionText = String(pref.shopDescription || '');
  const addressText = String(pref.shopAddress || '');
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: shop.name,
    image: logo || undefined,
    description: descriptionText || undefined,
    ...(addressText || city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(addressText ? { streetAddress: addressText } : {}),
            ...(city ? { addressLocality: city } : {}),
            ...(district ? { addressRegion: district } : {}),
          },
        }
      : {}),
    ...(phone ? { telephone: phone } : {}),
    priceRange: items.length ? '₺' : undefined,
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
  </div>
  ${descriptionText ? `<div class="desc">${escapeHtml(descriptionText)}</div>` : ''}

  <h2 style="font-size:18px;margin-top:20px;">Ürünler ve fiyatlar</h2>
  ${items.length === 0 ? '<p style="color:#666;">Bu dükkanda henüz ürün kaydı yok.</p>' : `<ul>${productRows}</ul>`}

  <a class="cta" href="/">Uygulamada Gör →</a>

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

  const [merchants, merchantProducts, products] = await Promise.all([
    fetchAll('/rest/v1/users?select=id,name,avatar,location,preferences&is_merchant=eq.true&limit=2000'),
    fetchAll('/rest/v1/merchant_products?select=merchant_id,product_id,price,unit,images,is_active&limit=20000'),
    fetchAll('/rest/v1/products?select=id,name&limit=5000'),
  ]);

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
    const html = buildShopHtml(shop, items);
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
