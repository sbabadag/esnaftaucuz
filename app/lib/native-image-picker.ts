import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';

export type ImagePickSource = 'camera' | 'gallery';

const isUserCancel = (error: unknown) => {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    msg.includes('cancel') ||
    msg.includes('cancelled') ||
    msg.includes('canceled') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('no image picked') ||
    msg.includes('no images picked')
  );
};

/**
 * Android 13+ gallery uses system Photo Picker — no READ_MEDIA_IMAGES needed.
 * Requesting photos permission often hangs or denies and aborts the flow.
 */
async function ensureCameraPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const current = await Camera.checkPermissions();
    if (current.camera === 'granted' || current.camera === 'limited') return true;
    const requested = await Camera.requestPermissions({ permissions: ['camera'] });
    return requested.camera === 'granted' || requested.camera === 'limited';
  } catch {
    return true;
  }
}

function blobToFile(blob: Blob, filename: string, mime: string): File {
  try {
    return new File([blob], filename, { type: blob.type || mime });
  } catch {
    // Some WebViews lack File ctor — Blob with name is enough for Supabase upload.
    const named = blob as Blob & { name?: string; lastModified?: number };
    named.name = filename;
    named.lastModified = Date.now();
    return named as File;
  }
}

async function photoToFile(photo: Photo, filenamePrefix = 'photo'): Promise<File> {
  const format = (photo.format || 'jpeg').toLowerCase();
  const ext = format === 'jpeg' || format === 'jpg' ? 'jpg' : format;
  const mime = `image/${ext === 'jpg' ? 'jpeg' : format}`;
  const filename = `${filenamePrefix}-${Date.now()}.${ext}`;

  if (photo.webPath) {
    const response = await fetch(photo.webPath);
    if (!response.ok) throw new Error(`Fotoğraf okunamadı (${response.status})`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('Fotoğraf boş geldi');
    return blobToFile(blob, filename, mime);
  }

  if (photo.dataUrl) {
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();
    return blobToFile(blob, filename, mime);
  }

  if (photo.base64String) {
    const binary = atob(photo.base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return blobToFile(new Blob([bytes], { type: mime }), filename, mime);
  }

  throw new Error('Fotoğraf verisi alınamadı');
}

function pickViaHtmlInput(source: ImagePickSource, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) input.multiple = true;
    if (source === 'camera') input.setAttribute('capture', 'environment');
    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.onchange = () => {
      const files = input.files ? Array.from(input.files).filter((f) => f.type.startsWith('image/')) : [];
      finish(files);
    };
    input.oncancel = () => finish([]);
    // Fallback if cancel does not fire
    window.setTimeout(() => {
      if (!settled && !input.files?.length) finish([]);
    }, 60_000);
    input.click();
  });
}

/**
 * Native: Capacitor Camera (Uri + resize — avoids DataUrl OOM / WebView kill).
 * Web: HTML file input.
 * Returns [] when user cancels.
 */
export async function pickImages(options: {
  source: ImagePickSource;
  multiple?: boolean;
  quality?: number;
}): Promise<File[]> {
  const { source, multiple = false, quality = 70 } = options;

  if (!Capacitor.isNativePlatform()) {
    return pickViaHtmlInput(source, multiple);
  }

  if (source === 'camera') {
    const allowed = await ensureCameraPermission();
    if (!allowed) {
      throw new Error('Kamera izni gerekli. Ayarlardan izin verin.');
    }
  }

  try {
    if (multiple && source === 'gallery') {
      const result = await Camera.pickImages({
        quality,
        limit: 6,
        width: 1280,
        height: 1280,
      });
      const files: File[] = [];
      for (let i = 0; i < (result.photos || []).length; i++) {
        files.push(await photoToFile(result.photos[i] as Photo, `gallery-${i}`));
      }
      return files;
    }

    const photo = await Camera.getPhoto({
      quality,
      width: 1280,
      height: 1280,
      allowEditing: false,
      correctOrientation: true,
      // Uri is far safer on Android than DataUrl (large base64 can kill the WebView).
      resultType: CameraResultType.Uri,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      saveToGallery: false,
      promptLabelHeader: 'Fotoğraf',
      promptLabelPhoto: 'Galeriden seç',
      promptLabelPicture: 'Kamera',
      promptLabelCancel: 'İptal',
    });

    return [await photoToFile(photo, source === 'camera' ? 'camera' : 'gallery')];
  } catch (error) {
    if (isUserCancel(error)) return [];
    throw error;
  }
}

export async function pickSingleImage(source: ImagePickSource): Promise<File | null> {
  const files = await pickImages({ source, multiple: false });
  return files[0] || null;
}
