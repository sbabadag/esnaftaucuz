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
        // Use Capacitor Geolocation on native
        // First check and request permissions
        const permissions = await Geolocation.checkPermissions();
        console.log('📱 Native: Current permissions:', permissions);
        
        if (!hasLocationPermission(permissions)) {
          console.log('📱 Native: Requesting location permission...');
          const requestResult = await Geolocation.requestPermissions();
          console.log('📱 Native: Permission request result:', requestResult);
          
          if (!hasLocationPermission(requestResult)) {
            console.error('📱 Native: Location permission denied');
            throw new Error('Location permission denied');
          }
        }
        
        // Increased timeout for Android/iOS (30 seconds) to handle slower GPS acquisition
        console.log('📱 Native: Getting current position...');
        let position;
        try {
          position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 30000, // 30 seconds (increased for better GPS acquisition)
            maximumAge: 10000,
          });
        } catch {
          // Fallback for devices that only provide coarse location initially.
          position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 30000,
            maximumAge: 60000,
          });
        }
        console.log('📱 Native: Position obtained:', position);
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      } else {
        // Use HTML5 Geolocation API on web
        const webPosition = await new Promise<Position>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
          }

          console.log('🌐 Requesting geolocation on web...');
          const startTime = Date.now();

          // First try with high accuracy (slower but more accurate)
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const elapsed = Date.now() - startTime;
              console.log(`✅ Geolocation obtained in ${elapsed}ms`);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
            },
            (error) => {
              console.error('Geolocation error (high accuracy):', error);
              
              // If timeout or position unavailable, try with lower accuracy
              if (error.code === 3 || error.code === 2) {
                console.log('⚠️ Retrying with lower accuracy...');
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const elapsed = Date.now() - startTime;
                    console.log(`✅ Geolocation obtained (low accuracy) in ${elapsed}ms`);
                    resolve({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                    });
                  },
                  (retryError) => {
                    console.error('Geolocation error (low accuracy):', retryError);
                    reject(retryError);
                  },
                  {
                    enableHighAccuracy: false,
                    timeout: 15000, // 15 seconds for retry
                    maximumAge: 60000, // Accept cached position up to 1 minute old
                  }
                );
              } else {
                reject(error);
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 20000, // 20 seconds (increased from 10)
              maximumAge: 0, // Don't use cached position for first attempt
            }
          );
        });

        return webPosition;
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

