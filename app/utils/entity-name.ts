/**
 * Helpers to reject / soften garbage product & location names
 * (barcodes, GS1 strings, raw coordinates, placeholder "Mevcut Konum").
 */

const COORD_RE = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;
const BARCODE_RE = /^\d{8,14}$/;
const GS1_SKT_RE = /^\(\d+\).*(SKT|skt)/i;
const PLACEHOLDER_LOCATION_RE = /^(mevcut konum|current location|my location)$/i;

export function isGarbageEntityName(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (n.length < 2) return true;
  if (BARCODE_RE.test(n)) return true;
  if (GS1_SKT_RE.test(n)) return true;
  if (COORD_RE.test(n)) return true;
  if (PLACEHOLDER_LOCATION_RE.test(n)) return true;
  // Single token that is only punctuation / digits
  if (/^[\d\W_]+$/u.test(n) && n.length < 8) return true;
  return false;
}

export function assertCreatableEntityName(name: string, kind: 'product' | 'location'): string {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) {
    throw new Error(kind === 'product' ? 'Ürün adı en az 2 karakter olmalı' : 'Konum adı en az 2 karakter olmalı');
  }
  if (isGarbageEntityName(trimmed)) {
    throw new Error(
      kind === 'product'
        ? 'Geçersiz ürün adı (barkod / SKT / anlamsız metin kullanılamaz)'
        : 'Geçersiz konum adı (koordinat veya "Mevcut Konum" kullanılamaz)'
    );
  }
  return trimmed;
}

/** Display label for locations that were saved as placeholders or coordinates. */
export function formatLocationDisplayName(
  name: string | null | undefined,
  lat?: number | null,
  lng?: number | null
): string {
  const n = String(name || '').trim();
  if (!isGarbageEntityName(n) && n) return n;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `Konum (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  }
  if (COORD_RE.test(n)) return `Konum (${n})`;
  return 'Konum';
}
