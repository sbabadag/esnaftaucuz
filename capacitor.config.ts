import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  webDir: 'dist',
  // Production: No server.url = use bundled files from assets/public
  // androidScheme defaults to 'https' which uses capacitor://localhost
  // Development: Uncomment below to use dev server
  // server: {
  //   url: 'http://192.168.3.13:5173',
  //   cleartext: true
  // },
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

