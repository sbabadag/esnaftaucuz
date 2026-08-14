#!/usr/bin/env node

/**
 * SSG (Static Site Generation) — her ürün için statik HTML üretir.
 * `vite build` SONRASINDA çalışır; dist/p/{id}/index.html dosyalarını yazar.
 * Böylece Googlebot, JS render beklemeden anında tam HTML + JSON-LD alır.
 *
 * Çalışma: node scripts/generate-product-pages.mjs
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

function escapeJson(str) {
  return JSON.stringify(String(str ?? '')).slice(1, -1);
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

function buildProductHtml(product, prices, locationsById) {
  const numeric = prices
    .map((p) => Number(p.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const cheapest = numeric.length ? Math.min(...numeric) : null;
  const highest = numeric.length ? Math.max(...numeric) : null;
  const name = escapeHtml(product.name);
  const category = escapeHtml(product.category || '');
  const image = escapeHtml(product.image || '');
  const canonical = `${SITE_BASE}/p/${product.id}`;
  const description = `${product.name} fiyatları — ${prices.length} esnaf kaydı${cheapest !== null ? `, en düşük ${cheapest.toFixed(2)} ₺` : ''}. Güncel esnaf fiyatları.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image || undefined,
    description: `${product.name} — güncel esnaf fiyatları`,
    category: product.category || undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'TRY',
      lowPrice: cheapest !== null ? cheapest.toFixed(2) : undefined,
      highPrice: highest !== null ? highest.toFixed(2) : undefined,
      offerCount: prices.length,
    },
  };

  const priceRows = prices
    .slice(0, 20)
    .map((p) => {
      const loc = locationsById.get(p.location_id);
      const locName = loc ? escapeHtml(loc.name) : 'Konum belirtilmemiş';
      const district = loc?.district ? `, ${escapeHtml(loc.district)}` : '';
      const price = Number(p.price);
      return `<li style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;">
        <strong style="font-size:16px;">${Number.isFinite(price) ? price.toFixed(2) : '0.00'} ₺${p.unit ? ` <span style="color:#666;font-weight:400;">/ ${escapeHtml(p.unit)}</span>` : ''}</strong>
        <span style="color:#555;font-size:14px;">${locName}${district}${p.is_verified ? ' ✓' : ''}</span>
      </li>`;
    })
    .join('\n');

  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${name} fiyatları | esnaftaucuz" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ''}
  <meta name="twitter:card" content="summary" />
  <title>${name} fiyatları | esnaftaucuz</title>
  <script type="application/ld+json">${jsonLdString}</script>
  <style>
    body { max-width: 720px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, sans-serif; color: #111; }
    h1 { font-size: 28px; margin: 12px 0 4px; }
    .cat { color: #555; }
    .cheapest { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .cheapest .label { font-size: 14px; color: #15803d; }
    .cheapest .price { font-size: 32px; font-weight: 700; color: #166534; }
    ul { list-style: none; padding: 0; }
    a.cta { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #16a34a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 13px; }
  </style>
</head>
<body>
  ${image ? `<img src="${image}" alt="${name}" style="max-width:120px;height:auto;border-radius:8px;" />` : ''}
  <h1>${name}</h1>
  ${category ? `<span class="cat">${category}</span>` : ''}

  ${cheapest !== null ? `<div class="cheapest">
    <div class="label">En düşük fiyat</div>
    <div class="price">${cheapest.toFixed(2)} ₺</div>
    <div class="label">${prices.length} esnaf kaydı üzerinden</div>
  </div>` : ''}

  <h2 style="font-size:18px;margin-top:20px;">Fiyatlar</h2>
  ${prices.length === 0 ? '<p style="color:#666;">Bu ürün için henüz fiyat kaydı yok.</p>' : `<ul>${priceRows}</ul>`}

  <a class="cta" href="/">Uygulamada Gör →</a>
  <footer>Fiyatlar esnaf topluluğu tarafından paylaşılmaktadır. Güncel fiyatlar için esnaftaucuz uygulamasını kullanın.</footer>
</body>
</html>`;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  Supabase env eksik — SSG atlanıyor.');
    return;
  }

  console.log('📄 SSG: ürün sayfaları üretiliyor...');

  const [products, prices, locations] = await Promise.all([
    fetchAll('/rest/v1/products?select=id,name,category,image,default_unit&is_active=eq.true&order=name.asc&limit=5000'),
    fetchAll('/rest/v1/prices?select=id,product_id,price,unit,location_id,is_verified&limit=20000'),
    fetchAll('/rest/v1/locations?select=id,name,city,district&limit=5000'),
  ]);

  const locationsById = new Map(locations.map((l) => [l.id, l]));

  // Fiyatları ürün bazında grupla, en ucuz önce sırala
  const pricesByProduct = new Map();
  for (const p of prices) {
    if (!p.product_id) continue;
    const num = Number(p.price);
    if (!Number.isFinite(num) || num <= 0) continue;
    if (!pricesByProduct.has(p.product_id)) pricesByProduct.set(p.product_id, []);
    pricesByProduct.get(p.product_id).push(p);
  }
  for (const list of pricesByProduct.values()) {
    list.sort((a, b) => Number(a.price) - Number(b.price));
  }

  let written = 0;
  for (const product of products) {
    const list = pricesByProduct.get(product.id) || [];
    const html = buildProductHtml(product, list, locationsById);
    const dir = join(DIST_DIR, 'p', product.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
    written++;
  }

  console.log(`✅ SSG tamamlandı: ${written} ürün sayfası → dist/p/{id}/index.html`);
}

main().catch((err) => {
  console.error('❌ SSG üretilemedi:', err);
  process.exit(1);
});
