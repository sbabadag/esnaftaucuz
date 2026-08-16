#!/usr/bin/env node

// Android targetSdk / compileSdk'ı Google Play'in zorunlu tuttuğu API 36'ya
// (Android 16) sabitler. `npx cap add android` + `cap sync` sonrası çalışır;
// aksi halde Capacitor şablonu eski SDK'yı üretir ve Play güncelleme engeller.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradlePath = join(projectRoot, 'android', 'variables.gradle');

const COMPILE_SDK = 36;
const TARGET_SDK = 36;

let content;
try {
  content = readFileSync(gradlePath, 'utf8');
} catch {
  console.error('android/variables.gradle not found. Run `npx cap add android` first.');
  process.exit(1);
}

function setVar(text, varName, value) {
  const re = new RegExp(`${varName}\\s*=\\s*\\d+`);
  if (re.test(text)) {
    return text.replace(re, `${varName} = ${value}`);
  }
  // Değişken yoksa ext { } bloğunun içine ekle.
  if (text.includes('ext {')) {
    return text.replace('ext {', `ext {\n    ${varName} = ${value}`);
  }
  return `ext {\n    ${varName} = ${value}\n}\n${text}`;
}

content = setVar(content, 'compileSdkVersion', COMPILE_SDK);
content = setVar(content, 'targetSdkVersion', TARGET_SDK);

writeFileSync(gradlePath, content, 'utf8');
console.log(`Android SDK hedefi güncellendi: compileSdk=${COMPILE_SDK}, targetSdk=${TARGET_SDK} (Android 16).`);
