import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Loader2,
  MapPin,
  Navigation,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useGeolocation } from '../../../../src/hooks/useGeolocation';
import { resolveMerchantRoleFromProfile } from '../../../lib/merchant-role';
import {
  buildShoppingComparison,
  type ShoppingComparisonResult,
  type ShoppingItem,
  type ShoppingProduct,
} from '../../../lib/shopping-list';
import { pricesAPI, productsAPI } from '../../../services/supabase-api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

const RANGE_OPTIONS_KM = [1, 3, 5, 10, 20, 50];

function normalizeSearch(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ShoppingListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getCurrentPosition } = useGeolocation();
  const { lang } = useLanguage();
  const isMerchant = resolveMerchantRoleFromProfile(user);
  const storageKey = `shopping-list:v1:${user?.id || 'guest'}`;

  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [query, setQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(5);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [comparison, setComparison] = useState<{
    results: ShoppingComparisonResult[];
    total: number;
    missingCount: number;
  } | null>(null);

  useEffect(() => {
    if (isMerchant) navigate('/app/explore', { replace: true });
  }, [isMerchant, navigate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved?.items)) setItems(saved.items);
        if (RANGE_OPTIONS_KM.includes(Number(saved?.radiusKm))) {
          setRadiusKm(Number(saved.radiusKm));
        }
      }
    } catch {
      // Ignore invalid local list data.
    } finally {
      setHydratedStorageKey(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ items, radiusKm }));
    } catch {
      // Persistence is best effort.
    }
  }, [hydratedStorageKey, items, radiusKm, storageKey]);

  useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      try {
        setIsLoadingProducts(true);
        const rows = await productsAPI.getAll();
        if (!cancelled) setProducts(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.error('Shopping list products failed to load:', error);
        if (!cancelled) toast.error('Ürünler yüklenemedi');
      } finally {
        if (!cancelled) setIsLoadingProducts(false);
      }
    };
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIds = useMemo(() => new Set(items.map((item) => item.product.id)), [items]);
  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (normalizedQuery.length < 2) return [];
    return products
      .filter((product) => {
        if (selectedIds.has(product.id)) return false;
        return (
          normalizeSearch(product.name).includes(normalizedQuery) ||
          normalizeSearch(product.category || '').includes(normalizedQuery)
        );
      })
      .slice(0, 20);
  }, [products, query, selectedIds]);

  const addProduct = (product: ShoppingProduct) => {
    setItems((current) => [...current, { product, quantity: 1 }]);
    setQuery('');
    setComparison(null);
  };

  const removeProduct = (productId: string) => {
    setItems((current) => current.filter((item) => item.product.id !== productId));
    setComparison(null);
  };

  const updateQuantity = (productId: string, rawQuantity: string) => {
    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setItems((current) =>
      current.map((item) =>
        item.product.id === productId ? { ...item, quantity: Math.min(quantity, 999) } : item,
      ),
    );
    setComparison(null);
  };

  const calculateCheapest = async () => {
    if (items.length === 0) {
      toast.error('Önce alışveriş listenize ürün ekleyin');
      return;
    }

    try {
      setIsCalculating(true);
      setComparison(null);
      const position = await getCurrentPosition();
      if (!position) {
        toast.error('Yakındaki fiyatları bulmak için konum izni gerekiyor');
        return;
      }

      // Query each selected product so a globally limited price feed cannot
      // hide a valid nearby result for a less frequently reported product.
      const priceGroups = await Promise.all(
        items.map((item) => pricesAPI.getByProduct(item.product.id, 'cheapest')),
      );
      const prices = priceGroups.flatMap((rows) => (Array.isArray(rows) ? rows : []));
      const result = buildShoppingComparison(
        items,
        prices,
        { lat: position.latitude, lng: position.longitude },
        radiusKm,
      );
      setComparison(result);
      if (result.missingCount === items.length) {
        toast.info(`${radiusKm} km içinde listedeki ürünler için fiyat bulunamadı`);
      }
    } catch (error) {
      console.error('Shopping comparison failed:', error);
      toast.error('En ucuz fiyatlar hesaplanamadı');
    } finally {
      setIsCalculating(false);
    }
  };

  if (isMerchant) return null;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header
        className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 pb-3"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-2">
            <ShoppingCart className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {lang === 'tr' ? 'Alışveriş Listem' : 'Shopping List'}
            </h1>
            <p className="text-xs text-gray-500">
              {lang === 'tr' ? 'Yakındaki en ucuz fiyatları bul' : 'Find the cheapest nearby prices'}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4 pb-28">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="shopping-product-search" className="mb-2 block text-sm font-semibold text-gray-900">
            {lang === 'tr' ? 'Ürün ekle' : 'Add a product'}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              id="shopping-product-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={lang === 'tr' ? 'Ürün ara: süt, domates, ekmek...' : 'Search products...'}
              className="pl-9"
            />
          </div>

          {isLoadingProducts && (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {lang === 'tr' ? 'Ürünler yükleniyor...' : 'Loading products...'}
            </div>
          )}

          {query.trim().length >= 2 && !isLoadingProducts && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              {searchResults.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  {lang === 'tr' ? 'Eşleşen ürün bulunamadı' : 'No matching products'}
                </p>
              ) : (
                searchResults.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => addProduct(product)}
                    className="flex w-full items-center gap-3 border-b border-gray-100 p-3 text-left last:border-b-0 hover:bg-gray-50"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category || 'Diğer'}</p>
                    </div>
                    <Plus className="h-5 w-5 text-green-600" />
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {lang === 'tr' ? `Listem (${items.length})` : `My list (${items.length})`}
            </h2>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  setComparison(null);
                }}
                className="text-xs font-medium text-red-600"
              >
                {lang === 'tr' ? 'Listeyi temizle' : 'Clear list'}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-8 text-center">
              <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-500">
                {lang === 'tr' ? 'Aramadan ürün ekleyerek listenizi oluşturun.' : 'Search and add products to create your list.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-xs text-gray-500">{item.product.default_unit || 'adet'}</p>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <span>{lang === 'tr' ? 'Miktar' : 'Qty'}</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max="999"
                      step="0.5"
                      value={item.quantity}
                      onChange={(event) => updateQuantity(item.product.id, event.target.value)}
                      className="h-9 w-20"
                      aria-label={`${item.product.name} miktarı`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeProduct(item.product.id)}
                    className="rounded-full p-2 text-red-500 hover:bg-red-50"
                    aria-label={`${item.product.name} ürününü listeden kaldır`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <label htmlFor="shopping-radius" className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4 text-green-600" />
            {lang === 'tr' ? 'Arama mesafesi' : 'Search radius'}
          </label>
          <select
            id="shopping-radius"
            value={radiusKm}
            onChange={(event) => {
              setRadiusKm(Number(event.target.value));
              setComparison(null);
            }}
            className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            {RANGE_OPTIONS_KM.map((range) => (
              <option key={range} value={range}>{range} km</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            {lang === 'tr'
              ? 'Hesaplama sırasında mevcut konumunuz kullanılır.'
              : 'Your current location is used during calculation.'}
          </p>
          <Button
            onClick={calculateCheapest}
            disabled={items.length === 0 || isCalculating}
            className="mt-4 w-full bg-green-600 py-6 text-base hover:bg-green-700"
          >
            {isCalculating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Hesaplanıyor...</>
            ) : (
              <><Navigation className="mr-2 h-4 w-4" />{lang === 'tr' ? 'En ucuz fiyatları bul' : 'Find cheapest prices'}</>
            )}
          </Button>
        </section>

        {comparison && (
          <section className="space-y-3" aria-live="polite">
            <div className="rounded-xl bg-green-700 p-4 text-white shadow-sm">
              <p className="text-sm text-green-100">
                {lang === 'tr' ? `${radiusKm} km içindeki toplam` : `Total within ${radiusKm} km`}
              </p>
              <p className="mt-1 text-3xl font-bold">{formatMoney(comparison.total)}</p>
              <p className="mt-1 text-xs text-green-100">
                {comparison.missingCount === 0
                  ? (lang === 'tr' ? 'Listedeki tüm ürünler bulundu.' : 'All list products were found.')
                  : (lang === 'tr'
                    ? `${comparison.missingCount} ürün için yakında fiyat bulunamadı.`
                    : `${comparison.missingCount} products had no nearby price.`)}
              </p>
            </div>

            {comparison.results.map((result) => (
              <article key={result.item.product.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/app/product/${result.item.product.id}`)}
                    className="min-w-0 text-left"
                  >
                    <h3 className="truncate font-semibold text-gray-900">{result.item.product.name}</h3>
                    <p className="text-xs text-gray-500">
                      {result.item.quantity} {result.item.product.default_unit || result.cheapest?.unit || 'adet'}
                    </p>
                  </button>
                  {result.lineTotal !== null && (
                    <p className="whitespace-nowrap text-lg font-bold text-green-700">{formatMoney(result.lineTotal)}</p>
                  )}
                </div>

                {result.cheapest ? (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-800">
                        {formatMoney(Number(result.cheapest.price))}/{result.cheapest.unit || result.item.product.default_unit}
                      </span>
                      <span className="text-xs text-gray-500">{result.distanceKm?.toFixed(1)} km</span>
                    </div>
                    <p className="mt-1 text-gray-600">
                      {result.cheapest.location?.name || (lang === 'tr' ? 'Konum bilgisi yok' : 'Location unavailable')}
                    </p>
                    {result.cheapest.location?.id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/location/${result.cheapest?.location?.id}`)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-green-700"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {lang === 'tr' ? 'Mağazayı görüntüle' : 'View store'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    {lang === 'tr'
                      ? `${radiusKm} km içinde uygun fiyat bulunamadı.`
                      : `No compatible price found within ${radiusKm} km.`}
                  </div>
                )}
              </article>
            ))}

            <p className="px-1 text-xs text-gray-500">
              {lang === 'tr'
                ? 'Toplam, her ürünün seçilen mesafe içindeki en ucuz fiyatından hesaplanır; ürünler farklı mağazalarda olabilir.'
                : 'The total uses each product’s cheapest price in range; products may come from different stores.'}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
