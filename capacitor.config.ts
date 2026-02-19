import { CapacitorConfig } from '@capacitor/cli';

// Build config conditionally based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const capacitorServerUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  webDir: 'dist',
  // Production: No server.url = use bundled files from assets/public
  // androidScheme defaults to 'https' which uses capacitor://localhost
  // Development: Use dev server for live reload
  // IMPORTANT: server.url is only set in development mode via environment variable
  ...(isDevelopment && capacitorServerUrl ? {
    server: {
      url: capacitorServerUrl,
      cleartext: true
    }
  } : {}),
  plugins: {
    Camera: {
      permissions: {
        camera: 'esnaftaucuz needs access to your camera to take photos of prices.',
        photos: 'esnaftaucuz needs access to your photos to select price images.',
      },
    },
    Geolocation: {
      permissions: {
        location: 'esnaftaucuz, sana en yakın fiyatları gösterebilmek için konumuna ihtiyaç duyuyor.',
      },
    },
  },
};

export default config;

