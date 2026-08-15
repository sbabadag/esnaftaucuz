import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import SeoHead from '../seo/SeoHead';
import { getAnonReadClient } from '../../lib/supabase';

/**
 * Herkese açık (login'siz) ürün sayfası — SEO için.
 * Googlebot ve linki açan ziyaretçiler buradan ürün fiyatlarını görür.
 * Dinamik title/description/JSON-LD ile taranabilir içerik sunar.
 */

interface PublicProduct {
  id: string;
  name: string;
  category?: string;
  image?: string;
  default_unit?: string;
}

interface PublicPrice {
  id: string;
  price: number | string;
  unit?: string;
  created_at?: string;
  is_verified?: boolean;
  location?: { id?: string; name?: string; city?: string; district?: string } | null;
}

export default function PublicProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [prices, setPrices] = useState<PublicPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Ürün bulunamadı');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const client = getAnonReadClient();
        if (!client) throw new Error('anon client yok');

        const [productRes, pricesRes] = await Promise.all([
          client.from('products').select('id,name,category,image,default_unit').eq('id', id).maybeSingle(),
          client.from('prices').select('id,price,unit,created_at,is_verified,location_id').eq('product_id', id).order('price', { ascending: true }).limit(50),
        ]);

        if (cancelled) return;

        if (productRes.error || !productRes.data) {
          setError('Ürün bulunamadı');
          setIsLoading(false);
          return;
        }

        setProduct(productRes.data as PublicProduct);

        const rows = (pricesRes.data || []) as any[];
        const locationIds = Array.from(new Set(rows.map((r) => r.location_id).filter(Boolean)));
        let locationMap = new Map<string, any>();
        if (locationIds.length > 0) {
          const { data: locs } = await client
            .from('locations')
            .select('id,name,city,district')
            .in('id', locationIds);
          locationMap = new Map((locs || []).map((l: any) => [l.id, l]));
        }

        const hydrated = rows.map((r) => ({
          ...r,
          price: typeof r.price === 'number' ? r.price : Number(r.price || 0),
          location: r.location_id ? locationMap.get(r.location_id) || null : null,
        }));

        if (!cancelled) setPrices(hydrated);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Yükleme hatası');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const numericPrices = prices.filter((p) => Number.isFinite(Number(p.price))).map((p) => Number(p.price));
  const cheapest = numericPrices.length > 0 ? Math.min(...numericPrices) : null;
  const highest = numericPrices.length > 0 ? Math.max(...numericPrices) : null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = origin.replace(/\/$/, '');
  const canonicalUrl = product ? `${base}/p/${product.id}` : undefined;
  const imageUrl = product?.image || undefined;
  const description = product
    ? `${product.name} fiyatları — ${prices.length} esnaf kaydı${cheapest !== null ? `, en düşük ${cheapest.toFixed(2)} ₺` : ''}. Mahallenizdeki güncel ${product.category || 'market'} fiyatları.`
    : 'esnaftaucuz — esnaf fiyat paylaşım uygulaması.';

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: imageUrl,
        description: `${product.name} — güncel esnaf fiyatları`,
        category: product.category || undefined,
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'TRY',
          ...(cheapest !== null ? { lowPrice: cheapest.toFixed(2) } : {}),
          ...(highest !== null ? { highPrice: highest.toFixed(2) } : {}),
          offerCount: prices.length,
        },
      }
    : undefined;

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: 'system-ui', textAlign: 'center' }}>Yükleniyor...</div>;
  }

  if (error || !product) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <SeoHead title="Ürün bulunamadı | esnaftaucuz" description="Aradığınız ürün bulunamadı." canonicalUrl={canonicalUrl} />
        <h1>Ürün bulunamadı</h1>
        <p>Bu ürün artık mevcut olmayabilir.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <SeoHead
        title={`${product.name} fiyatları`}
        description={description}
        canonicalUrl={canonicalUrl}
        imageUrl={imageUrl}
        ogType="product"
        jsonLd={jsonLd}
      />

      <header style={{ marginBottom: 24 }}>
        {imageUrl && <img src={imageUrl} alt={product.name} style={{ maxWidth: 120, height: 'auto', borderRadius: 8 }} />}
        <h1 style={{ fontSize: 28, margin: '12px 0 4px' }}>{product.name}</h1>
        {product.category && <span style={{ color: '#555' }}>{product.category}</span>}
      </header>

      {cheapest !== null && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: '#15803d' }}>En düşük fiyat</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#166534' }}>{cheapest.toFixed(2)} ₺</div>
          <div style={{ fontSize: 13, color: '#15803d' }}>{prices.length} esnaf kaydı üzerinden</div>
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Fiyatlar</h2>
      {prices.length === 0 ? (
        <p style={{ color: '#666' }}>Bu ürün için henüz fiyat kaydı yok.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {prices.map((p) => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{Number(p.price).toFixed(2)} ₺</strong>
                {p.unit && <span style={{ color: '#666', marginLeft: 6 }}>/ {p.unit}</span>}
              </div>
              <div style={{ color: '#555', fontSize: 14, textAlign: 'right' }}>
                {p.location?.name || 'Konum belirtilmemiş'}
                {p.location?.district ? `, ${p.location.district}` : ''}
                {p.is_verified ? ' ✓' : ''}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ textAlign: 'center', marginTop: 24, padding: 20, background: '#f8fafc', borderRadius: 10 }}>
        <div style={{ fontSize: 14, color: '#333', marginBottom: 10 }}>Güncel fiyatları kaçırmayın — uygulamayı Google Play'den indirin:</div>
        <a href="https://play.google.com/store/apps/details?id=com.esnaftaucuz.app" target="_blank" rel="noopener noreferrer">
          <img
            src="https://play.google.com/intl/en_us/badges/static/images/badges/tr_badge_web_generic.png"
            alt="Google Play'den indir"
            style={{ height: 52, width: 'auto' }}
          />
        </a>
      </div>

      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee', color: '#999', fontSize: 13 }}>
        Fiyatlar esnaf topluluğu tarafından paylaşılmaktadır. Güncel fiyatlar için esnaftaucuz uygulamasını kullanın.
      </footer>
    </div>
  );
}
