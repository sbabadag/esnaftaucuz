import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

let startupPromise: Promise<void> | null = null;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Native (Android/iOS) cold start: request location, notifications, then camera/photos
 * in sequence so system dialogs are not stacked. Safe to call from multiple places;
 * only one run is in flight.
 */
export function ensureNativeStartupPermissions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve();
  }
  if (!startupPromise) {
    startupPromise = (async () => {
      try {
        await Geolocation.requestPermissions().catch(() => undefined);
        await pause(400);
        await Promise.race([
          FirebaseMessaging.requestPermissions(),
          new Promise<unknown>((resolve) => setTimeout(resolve, 8000)),
        ]).catch(() => undefined);
        await pause(400);
        await Camera.requestPermissions({ permissions: ['camera', 'photos'] }).catch(() => undefined);
      } catch {
        // best-effort; individual features may re-prompt when used
      }
    })();
  }
  return startupPromise;
}
