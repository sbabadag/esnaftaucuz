import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import App from '../app/App';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import '../styles/index.css';
import '../app/styles/dark-overrides.css';
import 'leaflet/dist/leaflet.css';

// Initialize Capacitor plugins for native
if (Capacitor.isNativePlatform()) {
  if (import.meta.env.PROD && !import.meta.env.VITE_DEBUG_LOGS) {
    // Reduce JS<->native bridge noise on production builds.
    // (Hata ayıklama için VITE_DEBUG_LOGS=1 ile logcat'e JS logları düşürülebilir.)
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
  }

  // Keep WebView below status bar to prevent content bleed into
  // the top dead zone during aggressive overscroll.
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);

  // Set status bar style
  StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
  
  // Keyboard accessory bar is iOS-only; never block startup on plugin errors.
  if (Capacitor.getPlatform() === 'ios') {
    Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => undefined);
  }

}

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('❌ Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

// SPA derin link kurtarma: GitHub Pages'te bilinmeyen yollar 404.html'e düşer ve
// 404.html onları '/?//p/<id>' biçimine çevirir. Bu sorgu formatını gerçek yola
// geri yazarız — aksi halde Google'dan gelen eski ürün/dükkan linkleri ana
// sayfaya düşer ("doğru ürüne gitmiyor" şikayeti).
(function restoreDeepPathFromQuery() {
  try {
    const s = window.location.search || '';
    if (s.charAt(0) === '?' && s.charAt(1) === '/') {
      const raw = s.slice(2); // '/p/<id>' veya '/p/<id>&q=...'
      const [pathPart, ...rest] = raw.split('&');
      const path = '/' + (pathPart || '').replace(/~and~/g, '&');
      const query = rest.length ? '?' + rest.join('&').replace(/~and~/g, '&') : '';
      window.history.replaceState(null, '', path + query + window.location.hash);
    }
  } catch {
    /* sessiz — normal açılış devam eder */
  }
})();

// HATA AYIKLAMA (yalnızca VITE_DEBUG_LOGS=1 build'leri): URL değişimlerinin kaynağını izle.
if (import.meta.env.VITE_DEBUG_LOGS) {
  try {
    const origPush = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);
    window.history.pushState = function (...args: any[]) {
      console.log('[URL-TRACE] pushState →', String(args[2] ?? ''));
      return (origPush as (...a: any[]) => void)(...args);
    };
    window.history.replaceState = function (...args: any[]) {
      console.log('[URL-TRACE] replaceState →', String(args[2] ?? ''));
      return (origReplace as (...a: any[]) => void)(...args);
    };
    window.addEventListener('popstate', () => {
      console.log('[URL-TRACE] popstate →', window.location.pathname + window.location.search);
    });
    window.addEventListener('hashchange', () => {
      console.log('[URL-TRACE] hashchange →', window.location.pathname + window.location.hash);
    });
  } catch {
    /* izleme eklenemezse sorun değil */
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
