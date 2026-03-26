import { CapacitorConfig } from '@capacitor/cli';

// Build config conditionally based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const capacitorServerUrl = process.env.CAPACITOR_SERVER_URL;

// Read version from package.json (kept in sync with web package version)
const pkg = require('./package.json');
const version = pkg.version || '0.0.1';
// derive android versionCode from semver: M*10000 + m*100 + p
const sem = version.split('.').map((v: string) => parseInt(v, 10) || 0);
const androidVersionCode = (sem[0] || 0) * 10000 + (sem[1] || 0) * 100 + (sem[2] || 0);

const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  version,
  android: {
    versionCode: androidVersionCode,
    webContentsDebuggingEnabled: true,
  },
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

