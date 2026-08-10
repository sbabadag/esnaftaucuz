/**
 * afterShellExecution: if mobile install succeeded, clear pending flag.
 */
import fs from 'node:fs';
import path from 'node:path';

const PENDING = path.join(process.cwd(), '.cursor', 'pending-android-install');
const INSTALLED = path.join(process.cwd(), '.cursor', 'android-install-done');

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

const cmd = String(payload.command || payload.cmd || '');
const output = String(payload.output || payload.stdout || payload.result || '');
const code = payload.exit_code ?? payload.exitCode ?? payload.status;

const isInstallCmd =
  /install-android-device\.ps1|mobile:install|gradlew\.bat installDebug|cap sync android/i.test(
    cmd
  );
const looksOk =
  code === 0 ||
  /DONE: installed|Installed on 1 device|BUILD SUCCESSFUL/i.test(output);

if (isInstallCmd && looksOk) {
  try {
    if (fs.existsSync(PENDING)) fs.unlinkSync(PENDING);
  } catch {
    /* ignore */
  }
  fs.mkdirSync(path.dirname(INSTALLED), { recursive: true });
  fs.writeFileSync(INSTALLED, new Date().toISOString(), 'utf8');
}

process.stdout.write('{}\n');
