/**
 * afterFileEdit: mark that an Android-shipping file changed so stop can follow up.
 */
import fs from 'node:fs';
import path from 'node:path';

const PENDING = path.join(process.cwd(), '.cursor', 'pending-android-install');

const SHIPPING =
  /^(app|src)[/\\]|^(index\.html)$|^public[/\\]|^\.env$|^capacitor\.config\.|^android[/\\]/i;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const raw = await readStdin();
let payload = {};
try {
  payload = JSON.parse(raw || '{}');
} catch {
  payload = {};
}

const filePath = String(
  payload.file_path ||
    payload.filePath ||
    payload.path ||
    payload.uri ||
    ''
).replace(/\\/g, '/');

const rel = filePath.includes('esnaftaucuz/')
  ? filePath.split('esnaftaucuz/').pop()
  : filePath.replace(/^.*Projects\/esnaftaucuz\//i, '');

if (rel && SHIPPING.test(rel)) {
  fs.mkdirSync(path.dirname(PENDING), { recursive: true });
  fs.writeFileSync(PENDING, `${new Date().toISOString()}\n${rel}\n`, 'utf8');
}

process.stdout.write('{}\n');
