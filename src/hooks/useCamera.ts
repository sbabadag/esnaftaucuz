import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { isNative } from '../utils/capacitor';

export interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  source?: CameraSource;
}

/**
 * Hook for camera functionality (works on both web and native)
 */
export const useCamera = () => {
  const takePicture = async (options: CameraOptions = {}): Promise<File | null> => {
    try {
      if (isNative()) {
        // Use Capacitor Camera on native
        const photo: Photo = await Camera.getPhoto({
          quality: options.quality || 90,
          allowEditing: options.allowEditing || false,
          resultType: CameraResultType.Uri,
          source: options.source || CameraSource.Camera,
        });

        // Convert Capacitor photo to File
        const response = await fetch(photo.webPath!);
        const blob = await response.blob();
        const file = new File([blob], 'photo.jpg', { type: blob.type });
        return file;
      } else {
        // Use HTML5 file input on web
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (options.source === CameraSource.Camera) {
            input.capture = 'environment';
          }
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0] || null;
            resolve(file);
          };
          input.click();
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  };

  const pickFromGallery = async (): Promise<File | null> => {
    return takePicture({ source: CameraSource.Photos });
  };

  return {
    takePicture,
    pickFromGallery,
  };
};

