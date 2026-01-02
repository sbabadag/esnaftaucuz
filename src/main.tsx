import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import App from '../app/App';
import '../styles/index.css';
import 'leaflet/dist/leaflet.css';

// Initialize Capacitor plugins for native
if (Capacitor.isNativePlatform()) {
  // Set status bar style
  StatusBar.setStyle({ style: Style.Light });
  
  // Handle keyboard
  Keyboard.setAccessoryBarVisible({ isVisible: true });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
