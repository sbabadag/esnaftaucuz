#!/usr/bin/env node

/**
 * Initialize Capacitor for mobile development
 * Run this after npm install
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing Capacitor...\n');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.error('❌ node_modules not found. Please run "npm install" first.');
  process.exit(1);
}

try {
  // Initialize Capacitor
  console.log('📦 Initializing Capacitor...');
  execSync('npx cap init', { stdio: 'inherit' });

  // Add platforms
  console.log('\n📱 Adding Android platform...');
  execSync('npx cap add android', { stdio: 'inherit' });

  console.log('\n🍎 Adding iOS platform...');
  execSync('npx cap add ios', { stdio: 'inherit' });

  // Sync
  console.log('\n🔄 Syncing platforms...');
  execSync('npx cap sync', { stdio: 'inherit' });

  console.log('\n✅ Capacitor initialized successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Run: npm run mobile:build');
  console.log('   2. Run: npm run mobile:ios (Mac) or npm run mobile:android');
  console.log('   3. Open the project in Xcode/Android Studio');
  console.log('\n📚 See MOBILE_SETUP.md for more details.\n');

} catch (error) {
  console.error('❌ Error initializing Capacitor:', error.message);
  console.log('\n💡 Try running manually:');
  console.log('   npx cap init');
  console.log('   npx cap add android');
  console.log('   npx cap add ios');
  console.log('   npx cap sync\n');
  process.exit(1);
}

