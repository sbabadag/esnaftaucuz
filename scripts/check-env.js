#!/usr/bin/env node

/**
 * Environment Variables Check Script
 * Checks if all required environment variables are set before production build
 * Reads from .env file if process.env doesn't have them
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Try to load .env file
function loadEnvFile() {
  const envFiles = ['.env.production', '.env'];
  const envVars = {};
  
  for (const envFile of envFiles) {
    try {
      const envPath = join(projectRoot, envFile);
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
          if (!envVars[key]) { // Don't override if already set
            envVars[key] = value;
          }
        }
      }
      console.log(`📄 Loaded ${envFile}`);
      break; // Use first found file
    } catch (e) {
      // File doesn't exist, continue
    }
  }
  
  return envVars;
}

const envFileVars = loadEnvFile();

const requiredVars = {
  VITE_SUPABASE_URL: 'Supabase project URL',
  VITE_SUPABASE_ANON_KEY: 'Supabase anonymous key',
  VITE_GOOGLE_MAPS_API_KEY: 'Google Maps API key (required for geocoding)',
};

const optionalVars = {
  VITE_API_URL: 'Backend API URL (optional if using Supabase only)',
  VITE_FIREBASE_API_KEY: 'Firebase Web API key (required for browser push notifications)',
  VITE_FIREBASE_AUTH_DOMAIN: 'Firebase Auth domain for web push setup',
  VITE_FIREBASE_PROJECT_ID: 'Firebase project id for web push setup',
  VITE_FIREBASE_STORAGE_BUCKET: 'Firebase storage bucket for web push setup',
  VITE_FIREBASE_MESSAGING_SENDER_ID: 'Firebase messaging sender id for web push setup',
  VITE_FIREBASE_APP_ID: 'Firebase app id for web push setup',
  VITE_FIREBASE_WEB_PUSH_VAPID_KEY: 'Firebase Web Push VAPID key',
};

console.log('🔍 Checking environment variables...\n');

let allSet = true;
const missing = [];
const present = [];

// Check required variables (from process.env or .env file)
for (const [varName, description] of Object.entries(requiredVars)) {
  // Check process.env first, then .env file
  const value = process.env[varName] || envFileVars[varName];
  if (!value || value.trim() === '') {
    console.error(`❌ ${varName}: MISSING - ${description}`);
    missing.push(varName);
    allSet = false;
  } else {
    // Mask the value for security
    const masked = value.length > 10 
      ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
      : '***';
    const source = process.env[varName] ? 'process.env' : '.env file';
    console.log(`✅ ${varName}: SET (${masked}) [${source}]`);
    present.push(varName);
  }
}

// Check optional variables
console.log('\n📋 Optional variables:');
for (const [varName, description] of Object.entries(optionalVars)) {
  const value = process.env[varName] || envFileVars[varName];
  if (!value || value.trim() === '') {
    console.log(`⚠️  ${varName}: NOT SET - ${description}`);
  } else {
    const masked = value.length > 10 
      ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
      : '***';
    const source = process.env[varName] ? 'process.env' : '.env file';
    console.log(`✅ ${varName}: SET (${masked}) [${source}]`);
  }
}

console.log('\n' + '='.repeat(60));

if (allSet) {
  console.log('✅ All required environment variables are set!');
  console.log('✅ Ready for production build.\n');
  process.exit(0);
} else {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\n💡 To fix:');
  console.error('   1. Create .env.production file in project root');
  console.error('   2. Add all required variables (see ENV_TEMPLATE.md)');
  console.error('   3. Or set them as environment variables before build\n');
  process.exit(1);
}
