import { defineConfig } from 'vite';
import path from 'path';
import os from 'os';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Helper: detect a non-internal IPv4 address to make HMR reachable from mobile devices.
function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const list = nets[name] || [];
    for (const net of list) {
      // Node's types may vary; check for IPv4 and non-internal
      if ((net as any).family === 'IPv4' && !(net as any).internal) {
        return (net as any).address;
      }
    }
  }
  return 'localhost';
}

const devHost = process.env.VITE_DEV_HOST || getLocalIp();
const devPort = process.env.VITE_DEV_PORT ? Number(process.env.VITE_DEV_PORT) : 5173;

// GitHub workflow sets CUSTOM_DOMAIN to string "false" when unset — must not treat as custom domain.
const usePagesSubpath =
  Boolean(process.env.GITHUB_ACTIONS) &&
  !['true', '1', 'yes'].includes(String(process.env.CUSTOM_DOMAIN || '').toLowerCase());

/** GitHub Pages project site base; set in CI via VITE_SITE_BASE. Local/Capacitor: unset → "/" */
function resolveBase(): string {
  const explicit = String(process.env.VITE_SITE_BASE ?? '').trim();
  if (explicit === '/') return '/';
  if (explicit !== '') {
    return explicit.endsWith('/') ? explicit : `${explicit}/`;
  }
  return usePagesSubpath ? '/esnaftaucuz/' : '/';
}

// Unified Vite config tuned for mobile livereload with Capacitor.
export default defineConfig({
  base: resolveBase(),
  plugins: [
    // React and Tailwind plugins are required
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // allow external connections on all interfaces
    port: devPort,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: devHost,
      port: devPort,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
  },
  publicDir: 'public',
});
