#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const callbackScheme = 'com.esnaftaucuz.app';
const requiredPermissions = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
];
const oauthIntentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${callbackScheme}" />
            </intent-filter>
`;

let manifest;
try {
  manifest = readFileSync(manifestPath, 'utf8');
} catch {
  console.error('AndroidManifest.xml not found. Run `npx cap add android` first.');
  process.exit(1);
}

let changed = false;

const missingPermissions = requiredPermissions.filter(
  (permission) => !manifest.includes(`android:name="${permission}"`)
);
if (missingPermissions.length > 0) {
  const permissionXml = missingPermissions
    .map((permission) => `    <uses-permission android:name="${permission}" />`)
    .join('\n');
  const manifestEnd = '</manifest>';
  if (!manifest.includes(manifestEnd)) {
    console.error('Could not locate Android manifest closing tag.');
    process.exit(1);
  }
  manifest = manifest.replace(manifestEnd, `${permissionXml}\n${manifestEnd}`);
  changed = true;
}

const hasViewAction = manifest.includes('android.intent.action.VIEW');
const hasCallbackScheme = manifest.includes(`android:scheme="${callbackScheme}"`);
if (!hasViewAction || !hasCallbackScheme) {
  const launcherFilterEnd = `            </intent-filter>\n\n        </activity>`;
  if (!manifest.includes(launcherFilterEnd)) {
    console.error('Could not locate MainActivity launcher intent filter.');
    process.exit(1);
  }

  manifest = manifest.replace(
    launcherFilterEnd,
    `            </intent-filter>\n${oauthIntentFilter}\n        </activity>`
  );
  changed = true;
}

if (changed) {
  writeFileSync(manifestPath, manifest, 'utf8');
  console.log('Configured Android OAuth callback and runtime permissions.');
} else {
  console.log('Android OAuth callback and runtime permissions already configured.');
}
