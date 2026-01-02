import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple paths to find .env file
const envPaths = [
  path.join(__dirname, '../.env'),  // backend/.env
  path.join(__dirname, '.env'),     // backend/lib/.env (fallback)
  path.resolve(process.cwd(), '.env'), // Current working directory
];

let envLoaded = false;
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    envLoaded = true;
    break;
  }
}

// Also try default location
if (!envLoaded) {
  dotenv.config();
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗ Missing');
  console.error('');
  console.error('💡 Make sure backend/.env file exists with:');
  console.error('   SUPABASE_URL=...');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=...');
  console.error('   SUPABASE_ANON_KEY=...');
  console.error('');
  console.error('📁 Tried paths:');
  envPaths.forEach(p => console.error('   -', p));
  throw new Error('Missing Supabase environment variables. Please check backend/.env file.');
}

// Server-side client with service role key (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Client-side client (respects RLS)
export const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_ANON_KEY || '',
);

