/**
 * stop: if shipping files were edited this turn and install did not run, follow up.
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

await readStdin();

const pending = fs.existsSync(PENDING);
const installedRecently =
  fs.existsSync(INSTALLED) &&
  Date.now() - fs.statSync(INSTALLED).mtimeMs < 3 * 60 * 1000;

if (pending && !installedRecently) {
  process.stdout.write(
    JSON.stringify({
      followup_message:
        'App shipping files changed this turn but the phone was not updated yet. Run `npm run mobile:install` (or scripts/install-android-device.ps1) now, then briefly confirm success or the blocker (no device / build error).',
    }) + '\n'
  );
} else {
  process.stdout.write('{}\n');
}
