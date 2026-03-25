import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { isNative } from '../../src/utils/capacitor';

/** Vite build sırasında package.json’dan enjekte edilir — yüklediğiniz AAB’deki JS ile aynı */
const bundleVersion =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : '0.0.0';

export type AppVersionInfo = {
  /** Bu ekranda gösterilecek ana sürüm: her zaman bundle (Play’deki manifest yanlış olsa bile) */
  version: string;
  /** Android versionName / iOS CFBundleShortVersionString (bilgi amaçlı) */
  nativeVersion: string | null;
  /** Native build / versionCode (Android) veya CFBundleVersion (iOS) */
  build: string | null;
};

/**
 * - Ana metin: bundle sürümü (__APP_VERSION__) — cap sync + vite build ile gelir.
 * - Ek: App.getInfo() ile mağaza/manifest raporu (emülatörde eski APK kalırsa burada fark görünür).
 */
export function useAppVersion(): AppVersionInfo {
  const [nativeVersion, setNativeVersion] = useState<string | null>(null);
  const [build, setBuild] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative()) return;

    let cancelled = false;
    App.getInfo()
      .then((info) => {
        if (cancelled) return;
        setNativeVersion(info.version && String(info.version).length > 0 ? String(info.version) : null);
        setBuild(info.build && String(info.build).length > 0 ? String(info.build) : null);
      })
      .catch(() => {
        /* native bilgi yok */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    version: bundleVersion,
    nativeVersion,
    build,
  };
}
