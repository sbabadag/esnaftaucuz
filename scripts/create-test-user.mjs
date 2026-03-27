#!/usr/bin/env node
/**
 * "Ucuzcu Gezgin" normal kullanıcı — iki yöntem:
 * 1) SUPABASE_SERVICE_ROLE_KEY varsa: Admin API (en güvenilir)
 * 2) Yoksa: VITE_SUPABASE_ANON_KEY ile signUp / signIn (e-posta onayı kapalıysa otomatik)
 *
 * .env: VITE_SUPABASE_URL, ve service_role VEYA anon key
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
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const DISPLAY_NAME = 'Ucuzcu Gezgin';
const EMAIL = env.TEST_USER_EMAIL || 'ucuzcu.gezgin.test@example.com';
const PASSWORD = env.TEST_USER_PASSWORD || 'UcuzcuGezgin2026!';

const profileRow = (userId) => ({
  id: userId,
  email: EMAIL,
  name: DISPLAY_NAME,
  is_guest: false,
  is_merchant: false,
  search_radius: 15,
  merchant_subscription_status: 'inactive',
  merchant_subscription_plan: null,
});

async function createWithServiceRole() {
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
    console.log('public.users:', row || '(satır yok)');
    if (!row) {
      const { error: u } = await supabase.from('users').upsert(profileRow(dup.id), { onConflict: 'id' });
      if (u) console.error('Profil eklenemedi:', u.message);
      else console.log('public.users satırı eklendi.');
    }
    return;
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

  const { error: upsertErr } = await supabase
    .from('users')
    .upsert(profileRow(created.user.id), { onConflict: 'id' });

  if (upsertErr) {
    console.error('public.users kaydı başarısız:', upsertErr.message);
    process.exit(1);
  }

  printOk(created.user.id);
}

async function createWithAnon() {
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let session = null;

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: { data: { name: DISPLAY_NAME, full_name: DISPLAY_NAME } },
  });

  if (signUpErr) {
    const msg = String(signUpErr.message || '').toLowerCase();
    const already =
      msg.includes('already') ||
      msg.includes('registered') ||
      signUpErr.status === 422 ||
      signUpErr.code === 'user_already_exists';
    if (already) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
      });
      if (signInErr || !signInData.session) {
        console.error('Hesap var ama giriş yapılamadı (şifre yanlış veya başka sorun):', signInErr?.message);
        process.exit(1);
      }
      session = signInData.session;
    } else {
      console.error('Kayıt hatası:', signUpErr.message);
      process.exit(1);
    }
  } else {
    session = signUpData.session;
    if (!session && signUpData.user) {
      console.error(
        'Kayıt oluştu ama oturum yok — Supabase’te "Confirm email" açık olabilir.\n' +
          'Dashboard → Authentication → Providers → Email → "Confirm email" kapatın veya\n' +
          'SUPABASE_SERVICE_ROLE_KEY ile tekrar çalıştırın.'
      );
      process.exit(1);
    }
  }

  if (!session?.user?.id) {
    console.error('Oturum alınamadı.');
    process.exit(1);
  }

  const userId = session.user.id;

  const { error: upsertErr } = await supabase.from('users').upsert(profileRow(userId), { onConflict: 'id' });

  if (upsertErr) {
    console.error('public.users kaydı başarısız:', upsertErr.message);
    process.exit(1);
  }

  printOk(userId);
}

function printOk(id) {
  console.log('Tamam — normal kullanıcı (Ucuzcu Gezgin).');
  console.log('  Görünen ad:', DISPLAY_NAME);
  console.log('  E-posta:   ', EMAIL);
  console.log('  Şifre:     ', PASSWORD);
  console.log('  user id:   ', id);
}

async function main() {
  if (!url) {
    console.error('VITE_SUPABASE_URL eksik.');
    process.exit(1);
  }
  if (serviceKey) {
    console.log('(service_role ile oluşturuluyor…)');
    await createWithServiceRole();
  } else if (anonKey) {
    console.log('(anon key ile kayıt/giriş — e-posta onayı kapalı olmalı)');
    await createWithAnon();
  } else {
    console.error('VITE_SUPABASE_ANON_KEY veya SUPABASE_SERVICE_ROLE_KEY gerekli (.env).');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
