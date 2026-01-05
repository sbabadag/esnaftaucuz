import { CapacitorConfig } from '@capacitor/cli';

// Development configuration with live reload
// This file is used when running with --livereload flag
const config: CapacitorConfig = {
  appId: 'com.esnaftaucuz.app',
  appName: 'esnaftaucuz',
  webDir: 'dist',
  // Development: Use dev server for live reload
  // Replace YOUR_LOCAL_IP with your computer's local IP address
  // Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
  // Example: http://192.168.1.100:5173
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:5173',
    cleartext: true, // Allow HTTP (not HTTPS) for local development
  },
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

