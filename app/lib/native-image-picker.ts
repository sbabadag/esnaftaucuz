import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';

export type ImagePickSource = 'camera' | 'gallery';

export type PickedImage = {
  file: File;
  /** Prefer Capacitor webPath / data URL — blob: often fails to paint in Android WebView. */
  previewUrl: string;
};

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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Önizleme oluşturulamadı'));
    reader.readAsDataURL(blob);
  });
}

async function photoToPicked(photo: Photo, filenamePrefix = 'photo'): Promise<PickedImage> {
  const format = (photo.format || 'jpeg').toLowerCase();
  const ext = format === 'jpeg' || format === 'jpg' ? 'jpg' : format;
  const mime = `image/${ext === 'jpg' ? 'jpeg' : format}`;
  const filename = `${filenamePrefix}-${Date.now()}.${ext}`;

  let blob: Blob | null = null;

  if (photo.webPath) {
    const response = await fetch(photo.webPath);
    if (!response.ok) throw new Error(`Fotoğraf okunamadı (${response.status})`);
    blob = await response.blob();
    if (!blob.size) throw new Error('Fotoğraf boş geldi');
  } else if (photo.dataUrl) {
    const response = await fetch(photo.dataUrl);
    blob = await response.blob();
  } else if (photo.base64String) {
    const binary = atob(photo.base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  }

  if (!blob) throw new Error('Fotoğraf verisi alınamadı');

  const file = blobToFile(blob, filename, mime);
  // Prefer data URL for form previews — Capacitor https://localhost/_capacitor_file_
  // URLs must never be persisted to DB (they break feed/search on other clients).
  const previewUrl = photo.dataUrl || (await blobToDataUrl(blob));

  return { file, previewUrl };
}

async function filesFromHtmlInput(source: ImagePickSource, multiple = false): Promise<PickedImage[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) input.multiple = true;
    if (source === 'camera') input.setAttribute('capture', 'environment');
    let settled = false;
    const finish = (files: PickedImage[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };
    input.onchange = async () => {
      const raw = input.files ? Array.from(input.files).filter((f) => f.type.startsWith('image/')) : [];
      try {
        const picked: PickedImage[] = [];
        for (const file of raw) {
          // Data URL is more reliable than blob: across WebViews / dialogs.
          picked.push({ file, previewUrl: await blobToDataUrl(file) });
        }
        finish(picked);
      } catch {
        finish(raw.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })));
      }
    };
    input.oncancel = () => finish([]);
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
}): Promise<PickedImage[]> {
  const { source, multiple = false, quality = 70 } = options;

  if (!Capacitor.isNativePlatform()) {
    return filesFromHtmlInput(source, multiple);
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
      const picked: PickedImage[] = [];
      for (let i = 0; i < (result.photos || []).length; i++) {
        try {
          picked.push(await photoToPicked(result.photos[i] as Photo, `gallery-${i}`));
        } catch (photoErr) {
          console.error(`Gallery photo #${i + 1} failed:`, photoErr);
        }
      }
      return picked;
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

    return [await photoToPicked(photo, source === 'camera' ? 'camera' : 'gallery')];
  } catch (error) {
    if (isUserCancel(error)) return [];
    throw error;
  }
}

export async function pickSingleImage(source: ImagePickSource): Promise<PickedImage | null> {
  const files = await pickImages({ source, multiple: false });
  return files[0] || null;
}
