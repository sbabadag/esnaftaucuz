import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config tuned for mobile livereload with Capacitor.
// - server.host=true makes dev server listen on all interfaces so device can reach it.
// - hmr.clientPort ensures the HMR client connects to the same port.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      clientPort: 5173,
    },
  },
});

import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Use /esnaftaucuz/ for GitHub Pages, / for custom domain
  base: process.env.GITHUB_ACTIONS && !process.env.CUSTOM_DOMAIN ? '/esnaftaucuz/' : '/',
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
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
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Copy public directory (CNAME file) to dist
    copyPublicDir: true,
    // Vite automatically injects VITE_* environment variables into import.meta.env
    // No need to manually define them - Vite handles this automatically
  },
  publicDir: 'public',
})
