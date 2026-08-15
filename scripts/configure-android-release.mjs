#!/usr/bin/env node
/**
 * CI için Android release imzalama konfigürasyonu.
 * `npx cap add android` sonrası çalıştırılır; Capacitor şablonundaki build.gradle'a
 * signingConfigs.release bloğunu enjekte eder ve keystore dosyasını yazar.
 *
 * Gerekli ortam değişkenleri:
 *   ANDROID_KEYSTORE_B64 — .jks keystore'un base64'ü
 *   KEYSTORE_PASSWORD   — keystore şifresi
 *   KEY_ALIAS           — alias (varsayılan: esnaftaucuz)
 *   KEY_PASSWORD        — key şifresi (boşsa keystore şifresi kullanılır)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const gradlePath = join(projectRoot, 'android', 'app', 'build.gradle');
const keystorePath = join(projectRoot, 'android', 'app', 'esnaftaucuz-release-key.jks');

const keystoreB64 = String(process.env.ANDROID_KEYSTORE_B64 || '').trim();
const storePassword = String(process.env.KEYSTORE_PASSWORD || '').trim();
const keyAlias = String(process.env.KEY_ALIAS || 'esnaftaucuz').trim();
const keyPassword = String(process.env.KEY_PASSWORD || '').trim() || storePassword;

if (!keystoreB64 || !storePassword) {
  console.error('❌ ANDROID_KEYSTORE_B64 ve KEYSTORE_PASSWORD ortam değişkenleri gerekli');
  process.exit(1);
}

const escapeGradle = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// 0) package.json'dan versionCode/versionName hesapla ve build.gradle'a yaz.
//    (cap add android, config'teki android.versionCode'u uygulamıyor — hep 1 kalıyor.)
const pkgJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const semParts = String(pkgJson.version || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
const derivedVersionCode = (semParts[0] || 0) * 10000 + (semParts[1] || 0) * 100 + (semParts[2] || 0);
{
  let gradleRaw = readFileSync(gradlePath, 'utf8');
  const codeBefore = gradleRaw.match(/versionCode (\d+)/)?.[1];
  gradleRaw = gradleRaw.replace(/versionCode \d+/, `versionCode ${derivedVersionCode}`);
  gradleRaw = gradleRaw.replace(/versionName "[^"]*"/, `versionName "${pkgJson.version}"`);
  writeFileSync(gradlePath, gradleRaw);
  console.log(`✅ build.gradle versionCode: ${codeBefore} → ${derivedVersionCode}, versionName → ${pkgJson.version}`);
}

// 1) Keystore'u yaz
writeFileSync(keystorePath, Buffer.from(keystoreB64, 'base64'));
console.log(`✅ Keystore yazıldı: ${keystorePath}`);

// 2) build.gradle'a imza bloğunu enjekte et
let gradle = readFileSync(gradlePath, 'utf8');

if (gradle.includes('signingConfigs')) {
  console.log('ℹ️ build.gradle zaten signingConfigs içeriyor — enjeksiyon atlandı');
} else {
  const target = `    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }`;

  if (!gradle.includes(target)) {
    console.error('❌ Capacitor build.gradle şablonu bulunamadı — enjeksiyon hedefi yok');
    process.exit(1);
  }

  const replacement = `    signingConfigs {
        release {
            storeFile file('esnaftaucuz-release-key.jks')
            storePassword '${escapeGradle(storePassword)}'
            keyAlias '${escapeGradle(keyAlias)}'
            keyPassword '${escapeGradle(keyPassword)}'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }`;

  gradle = gradle.replace(target, replacement);
  writeFileSync(gradlePath, gradle);
  console.log('✅ build.gradle imza bloğu enjekte edildi');
}

console.log('✅ configure-android-release tamamlandı');

// 3) AndroidManifest.xml'e App Links intent-filter'ı enjekte et:
// Google sonuçlarındaki https://www.esnaftaucuz.com/p/... ve /s/... linkleri
// uygulama kuruluysa doğrudan uygulamada açılsın (assetlinks.json ile doğrulanır).
const manifestPath = join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');

if (manifest.includes('android:host="www.esnaftaucuz.com"')) {
  console.log('ℹ️ AndroidManifest zaten App Links içeriyor — enjeksiyon atlandı');
} else {
  const schemeFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="@string/custom_url_scheme" />
            </intent-filter>`;

  if (!manifest.includes(schemeFilter)) {
    console.warn('⚠️ Capacitor AndroidManifest şablonu bulunamadı — App Links enjeksiyonu atlandı');
  } else {
    const appLinksFilter = `            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="www.esnaftaucuz.com" android:pathPrefix="/p/" />
                <data android:scheme="https" android:host="www.esnaftaucuz.com" android:pathPrefix="/s/" />
            </intent-filter>`;

    manifest = manifest.replace(schemeFilter, schemeFilter + '\n\n' + appLinksFilter);
    writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest App Links intent-filter enjekte edildi');
  }
}
