import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Android WebView'da `window.androidBridge` bazen ilk frame'den hemen sonra hazır olur.
 * Eski kod modül seviyesinde tek seferlik kontrol yapınca yanlışlıkla "web" kalıp
 * Play'den yüklenmiş uygulamada bile ödeme düğmesi kilitlenebiliyordu.
 */
function computeIsAndroidNative(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor Android: native bridge (dist/index.js getPlatformId)
  const hasAndroidBridge = !!(window as unknown as { androidBridge?: unknown }).androidBridge;
  if (hasAndroidBridge) return true;
  // Native WebView genelde capacitor://localhost ile açılır.
  if (window.location.protocol === 'capacitor:') return true;
  const platform = Capacitor.getPlatform();
  return Capacitor.isNativePlatform() && platform === 'android';
}

export function useIsAndroidNativeApp(): boolean {
  const [value, setValue] = useState(() => computeIsAndroidNative());

  useEffect(() => {
    const refresh = () => setValue(computeIsAndroidNative());
    refresh();
    const raf = requestAnimationFrame(refresh);
    const t1 = window.setTimeout(refresh, 50);
    const t2 = window.setTimeout(refresh, 250);
    const t3 = window.setTimeout(refresh, 750);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  return value;
}
