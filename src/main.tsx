import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import App from '../app/App';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import '../styles/index.css';
import 'leaflet/dist/leaflet.css';

// Initialize Capacitor plugins for native
if (Capacitor.isNativePlatform()) {
  // Set status bar style
  StatusBar.setStyle({ style: Style.Light }).catch((err) => {
    console.warn('StatusBar.setStyle failed:', err);
  });
  
  // Handle keyboard
  Keyboard.setAccessoryBarVisible({ isVisible: true }).catch((err) => {
    console.warn('Keyboard.setAccessoryBarVisible failed:', err);
  });
}

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
