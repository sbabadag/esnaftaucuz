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
    // Ensure environment variables are included in build
    define: {
      // Vite automatically includes VITE_* env vars, but we can explicitly define them
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
      // Google Maps API Key - use env var if available, otherwise use fallback for GitHub Pages
      // Note: This key is protected by referrer restrictions in Google Cloud Console
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || 'AIzaSyCGRGdSA0IZHxgGI4PCv00kQ8xJ5dpx7Gc'
      ),
    },
  },
  publicDir: 'public',
})
