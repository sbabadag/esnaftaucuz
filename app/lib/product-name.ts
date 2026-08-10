export interface CatalogProduct {
  id: string;
  name: string;
}

interface ResolveCatalogProductInput {
  productId: string;
  productName: string;
  products: CatalogProduct[];
  defaultUnit: string;
  createProduct: (
    name: string,
    category: string,
    defaultUnit: string
  ) => Promise<{ id?: string; _id?: string; name?: string }>;
}

export function normalizeProductName(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function comparableProductName(value: string): string {
  return normalizeProductName(value).toLocaleLowerCase('tr-TR');
}

export function productNamesMatch(a: string, b: string): boolean {
  return comparableProductName(a) === comparableProductName(b);
}

/**
 * Resolve a catalog product by selected id or typed name.
 * If the name is new, persists it via createProduct (products library).
 */
export async function resolveCatalogProduct({
  productId,
  productName,
  products,
  defaultUnit,
  createProduct,
}: ResolveCatalogProductInput): Promise<{ id: string; name: string; created: boolean }> {
  const normalizedName = normalizeProductName(productName);

  if (productId) {
    const selected = products.find((product) => product.id === productId);
    return {
      id: productId,
      name: selected?.name || normalizedName,
      created: false,
    };
  }

  if (!normalizedName) {
    throw new Error('Lütfen bir ürün adı girin');
  }

  const existing = products.find(
    (product) => comparableProductName(product.name) === comparableProductName(normalizedName)
  );
  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }

  const created = await createProduct(normalizedName, 'Diğer', defaultUnit || 'adet');
  const createdId = created?.id || created?._id;
  if (!createdId) {
    throw new Error('Ürün oluşturulamadı: Yeni ürün kimliği alınamadı');
  }

  return {
    id: createdId,
    name: created.name || normalizedName,
    created: true,
  };
}
