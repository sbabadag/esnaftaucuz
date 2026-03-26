import { Geolocation } from '@capacitor/geolocation';
import { isNative } from '../utils/capacitor';

export interface Position {
  latitude: number;
  longitude: number;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | string;

const isGranted = (value: PermissionState | undefined): boolean =>
  String(value || '').toLowerCase() === 'granted';

const hasLocationPermission = (permissions: any): boolean => {
  const fine = permissions?.location as PermissionState | undefined;
  const coarse = permissions?.coarseLocation as PermissionState | undefined;
  return isGranted(fine) || isGranted(coarse);
};

/**
 * Hook for geolocation (works on both web and native)
 */
export const useGeolocation = () => {
  const getCurrentPosition = async (): Promise<Position | null> => {
    try {
      if (isNative()) {
        const permissions = await Geolocation.checkPermissions();
        if (!hasLocationPermission(permissions)) {
          const requestResult = await Geolocation.requestPermissions();
          if (!hasLocationPermission(requestResult)) {
            throw new Error('Location permission denied');
          }
        }

        // Race: fast coarse location vs slower GPS - return whichever comes first
        const coarsePromise = Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 30000,
        }).catch(() => null);

        const gpsPromise = Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
        }).catch(() => null);

        const [coarse, gps] = await Promise.allSettled([coarsePromise, gpsPromise]);
        const gpsResult = gps.status === 'fulfilled' ? gps.value : null;
        const coarseResult = coarse.status === 'fulfilled' ? coarse.value : null;
        const position = gpsResult || coarseResult;

        if (!position) {
          throw new Error('Konum alınamadı');
        }
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      } else {
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported');
        }

        const getPos = (highAccuracy: boolean, timeout: number, maxAge: number) =>
          new Promise<Position>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
              reject,
              { enableHighAccuracy: highAccuracy, timeout, maximumAge: maxAge },
            );
          });

        // Race coarse (fast) vs GPS (accurate) - use whichever resolves first
        const result = await Promise.any([
          getPos(false, 5000, 30000),
          getPos(true, 10000, 10000),
        ]).catch(() => null);

        if (!result) throw new Error('Konum alınamadı');
        return result;
      }
    } catch (error) {
      console.error('Geolocation error:', error);
      return null;
    }
  };

  const watchPosition = (callback: (position: Position) => void): (() => void) | null => {
    try {
      if (isNative()) {
        // Use Capacitor watch position
        const watchId = Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
          },
          (position) => {
            callback({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        );

        return () => {
          Geolocation.clearWatch({ id: watchId });
        };
      } else {
        // Use HTML5 watch position
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            callback({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            console.error('Geolocation watch error:', error);
          },
          {
            enableHighAccuracy: true,
          }
        );

        return () => {
          navigator.geolocation.clearWatch(watchId);
        };
      }
    } catch (error) {
      console.error('Watch position error:', error);
      return null;
    }
  };

  return {
    getCurrentPosition,
    watchPosition,
  };
};

