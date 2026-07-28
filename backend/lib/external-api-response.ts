type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractPexelsImageUrl(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.photos) || payload.photos.length === 0) {
    return null;
  }

  const firstPhoto = payload.photos[0];
  if (!isRecord(firstPhoto) || !isRecord(firstPhoto.src)) return null;

  if (typeof firstPhoto.src.medium !== 'string') return null;

  try {
    const imageUrl = new URL(firstPhoto.src.medium);
    return imageUrl.protocol === 'https:' ? imageUrl.href : null;
  } catch {
    return null;
  }
}

export function extractCollectApiProductNames(payload: unknown): string[] {
  if (!isRecord(payload)) return [];

  const items = [payload.result, payload.data, payload.products].find(Array.isArray);
  if (!items) return [];

  const names: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;

    const name = [item.name, item.urun, item.product, item.urunAdi, item.title]
      .find((candidate): candidate is string => typeof candidate === 'string');
    const normalized = name?.trim().replace(/\s+/g, ' ');
    if (normalized) names.push(normalized);
  }

  return names;
}
