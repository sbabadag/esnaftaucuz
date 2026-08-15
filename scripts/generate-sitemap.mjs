#!/usr/bin/env node

/**
 * Sitemap oluşturucu — build öncesi çalışır.
 * Supabase'den aktif ürünleri çeker ve public/sitemap.xml üretir.
 * Vite build, public/ dizinini dist/'e kopyaladığı için sitemap otomatik yayınlanır.
 *
 * Çalışma: node scripts/generate-sitemap.mjs
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (process.env veya .env)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

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
      // dosya yok, devam
    }
  }
  return envVars;
}

const envFileVars = loadEnvFile();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envFileVars.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || envFileVars.VITE_SUPABASE_ANON_KEY || '';

// Site kök URL — özel alan adı (public/CNAME) veya env ile ayarlanabilir.
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

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchActiveProducts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY eksik — ürün URL\'leri sitemap\'e eklenemeyecek.');
    return [];
  }
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/products?select=id,name&is_active=eq.true&order=name.asc&limit=5000`;
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      console.warn(`⚠️  Ürün listesi alınamadı (HTTP ${resp.status}) — sitemap statik sayfalarla üretilecek.`);
      return [];
    }
    const rows = await resp.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn(`⚠️  Ürün listesi çekilemedi: ${err.message}`);
    return [];
  }
}

async function fetchMerchants() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('⚠️  Supabase env eksik — dükkan URL\'leri sitemap\'e eklenemeyecek.');
    return [];
  }
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/users?select=id&is_merchant=eq.true&limit=2000`;
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      console.warn(`⚠️  Dükkan listesi alınamadı (HTTP ${resp.status}) — sitemap dükkansız üretilecek.`);
      return [];
    }
    const rows = await resp.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn(`⚠️  Dükkan listesi çekilemedi: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('🗺️  Sitemap oluşturuluyor...');
  console.log(`📍 Site kök URL: ${SITE_BASE}`);

  const products = await fetchActiveProducts();
  console.log(`📦 ${products.length} aktif ürün bulundu.`);
  const merchants = await fetchMerchants();
  console.log(`🏪 ${merchants.length} esnaf dükkanı bulundu.`);

  const staticPaths = ['', '/onboarding', '/login'];
  const urls = [];

  for (const path of staticPaths) {
    urls.push({ loc: `${SITE_BASE}${path}`, lastmod: new Date().toISOString().slice(0, 10), priority: path === '' ? '1.0' : '0.5' });
  }

  for (const product of products) {
    urls.push({
      loc: `${SITE_BASE}/p/${product.id}`,
      lastmod: new Date().toISOString().slice(0, 10),
      priority: '0.8',
    });
  }

  for (const merchant of merchants) {
    if (!merchant || !merchant.id) continue;
    urls.push({
      loc: `${SITE_BASE}/s/${merchant.id}`,
      lastmod: new Date().toISOString().slice(0, 10),
      priority: '0.7',
    });
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  const outPath = join(projectRoot, 'public', 'sitemap.xml');
  writeFileSync(outPath, sitemap, 'utf-8');
  console.log(`✅ Sitemap yazıldı: ${outPath} (${urls.length} URL)`);
}

main().catch((err) => {
  console.error('❌ Sitemap oluşturulamadı:', err);
  process.exit(1);
});
