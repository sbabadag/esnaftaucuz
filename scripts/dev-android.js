#!/usr/bin/env node

import { execSync, spawn } from 'child_process';

function getConnectedDeviceIds() {
  const output = execSync('adb devices', { encoding: 'utf8' });
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);

  return lines
    .filter((line) => line.includes('\tdevice') && !line.startsWith('List of devices'))
    .map((line) => line.split('\t')[0])
    .filter(Boolean);
}

function getTargetDeviceId() {
  if (process.env.ANDROID_TARGET) return process.env.ANDROID_TARGET;

  const devices = getConnectedDeviceIds();
  if (devices.length === 0) {
    throw new Error(
      'No Android device detected. Connect a phone (USB debugging on) or start an emulator.'
    );
  }

  return devices[0];
}

function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const target = getTargetDeviceId();
  const port = process.env.DEV_PORT || '5173';

  const npxCommand = 'npx';
  const viteCommand = `${npxCommand} vite --host --strictPort --port ${port}`;
  const waitOnCommand = `${npxCommand} wait-on http://localhost:${port}`;
  const capRunCommand = `${npxCommand} cap run android --livereload --external --target ${target}`;

  console.log(`Using Android target: ${target}`);
  console.log('Starting hot reload...');

  if (isDryRun) {
    console.log(`Dry run command (1): ${viteCommand}`);
    console.log(`Dry run command (2): ${waitOnCommand}`);
    console.log(`Dry run command (3): ${capRunCommand}`);
    process.exit(0);
  }

  const viteProcess = spawn(viteCommand, {
    stdio: 'inherit',
    shell: true,
  });

  const waitOnProcess = spawn(waitOnCommand, {
    stdio: 'inherit',
    shell: true,
  });

  let capRunProcess = null;
  let isShuttingDown = false;

  const shutdown = (exitCode = 0) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (capRunProcess && !capRunProcess.killed) capRunProcess.kill();
    if (!waitOnProcess.killed) waitOnProcess.kill();
    if (!viteProcess.killed) viteProcess.kill();

    setTimeout(() => process.exit(exitCode), 150);
  };

  waitOnProcess.on('exit', (code) => {
    if (code !== 0) {
      shutdown(code ?? 1);
      return;
    }

    capRunProcess = spawn(capRunCommand, {
      stdio: 'inherit',
      shell: true,
    });

    capRunProcess.on('exit', (capCode) => {
      shutdown(capCode ?? 1);
    });
  });

  viteProcess.on('exit', (code) => {
    if (!isShuttingDown) {
      shutdown(code ?? 1);
    }
  });

  process.on('SIGINT', () => {
    shutdown(0);
  });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
