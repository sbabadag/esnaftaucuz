#!/usr/bin/env node
/**
 * Creates a normal (non-merchant) test user via Supabase Admin API + public.users row.
 *
 * Requires in .env (or environment):
 *   VITE_SUPABASE_URL  (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY   — Dashboard → Project Settings → API → service_role (secret)
 *
 * Usage:
 *   node scripts/create-test-user.mjs
 *   TEST_USER_EMAIL=x@y.com TEST_USER_PASSWORD='...' node scripts/create-test-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function loadEnvFile() {
  const env = { ...process.env };
  for (const name of ['.env.local', '.env.production', '.env']) {
    const p = join(projectRoot, name);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = t.match(/^([^=]+)=(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      let val = m[2].trim().replace(/^["']|["']$/g, '');
      if (env[key] === undefined) env[key] = val;
    }
  }
  return env;
}

const env = loadEnvFile();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const DISPLAY_NAME = 'Ucuzcu Gezgin';
const EMAIL = env.TEST_USER_EMAIL || 'ucuzcu.gezgin.test@example.com';
const PASSWORD = env.TEST_USER_PASSWORD || 'UcuzcuGezgin2026!';

if (!url || !serviceKey) {
  console.error(
    'Eksik ortam değişkeni: VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env içinde).'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error('Kullanıcı listelenemedi:', listErr.message);
    process.exit(1);
  }
  const dup = existing?.users?.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (dup) {
    console.log('Bu e-posta zaten kayıtlı:', EMAIL);
    console.log('user id:', dup.id);
    const { data: row } = await supabase.from('users').select('id,name,is_merchant').eq('id', dup.id).maybeSingle();
    console.log('public.users:', row || '(satır yok — giriş yapınca oluşabilir)');
    process.exit(0);
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: DISPLAY_NAME, full_name: DISPLAY_NAME },
  });

  if (createErr || !created?.user) {
    console.error('Auth kullanıcı oluşturulamadı:', createErr?.message || createErr);
    process.exit(1);
  }

  const id = created.user.id;

  const { error: upsertErr } = await supabase.from('users').upsert(
    {
      id,
      email: EMAIL,
      name: DISPLAY_NAME,
      is_guest: false,
      is_merchant: false,
      search_radius: 15,
    },
    { onConflict: 'id' }
  );

  if (upsertErr) {
    console.error('public.users kaydı başarısız:', upsertErr.message);
    process.exit(1);
  }

  console.log('Tamam — normal kullanıcı oluşturuldu.');
  console.log('  Görünen ad:', DISPLAY_NAME);
  console.log('  E-posta:   ', EMAIL);
  console.log('  Şifre:     ', PASSWORD, '(TEST_USER_PASSWORD ile değiştirebilirsin)');
  console.log('  user id:   ', id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
