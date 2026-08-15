import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import SeoHead from '../seo/SeoHead';
import { getAnonReadClient } from '../../lib/supabase';

/**
 * Herkese açık (login'siz) dükkan sayfası — SEO için SPA yedeği.
 * Statik /s/{id}/index.html dosyası bulunmadığında (404 fallback) bu bileşen render edilir.
 */

interface PublicShop {
  id: string;
  name: string;
  avatar?: string;
  location?: { city?: string; district?: string } | null;
  preferences?: {
    shopDescription?: string;
    shopAddress?: string;
    openingHours?: string;
    phone?: string;
    shopLogo?: string;
  } | null;
}

interface ShopItem {
  id: string;
  product_name: string;
  price: number | string;
  unit?: string;
}

export default function PublicShopPage() {
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Dükkan bulunamadı');
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

        const shopRes = await client
          .from('users')
          .select('id,name,avatar,location,preferences')
          .eq('id', id)
          .maybeSingle();

        if (cancelled) return;

        if (shopRes.error || !shopRes.data) {
          setError('Dükkan bulunamadı');
          setIsLoading(false);
          return;
        }

        setShop(shopRes.data as PublicShop);

        const [mpRes, prodRes] = await Promise.all([
          client
            .from('merchant_products')
            .select('id,product_id,price,unit,is_active')
            .eq('merchant_id', id)
            .limit(60),
          client.from('products').select('id,name').limit(5000),
        ]);

        if (cancelled) return;

        const productNameById = new Map<string, string>(
          ((prodRes.data as any[]) || []).map((p) => [p.id, p.name])
        );

        const rows = ((mpRes.data as any[]) || [])
          .filter((r) => r.is_active !== false && Number(r.price) > 0)
          .map((r) => ({
            id: r.id,
            product_name: productNameById.get(r.product_id) || 'Ürün',
            price: r.price,
            unit: r.unit,
          }))
          .sort((a, b) => a.product_name.localeCompare(b.product_name, 'tr'));

        if (!cancelled) setItems(rows);
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

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: 'system-ui', textAlign: 'center' }}>Yükleniyor...</div>;
  }

  if (error || !shop) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <SeoHead title="Dükkan bulunamadı" description="Aradığınız dükkan bulunamadı." />
        <h1>Dükkan bulunamadı</h1>
        <p>Bu dükkan artık mevcut olmayabilir.</p>
      </div>
    );
  }

  const pref = shop.preferences || {};
  const loc = shop.location || {};
  const city = loc.city || '';
  const district = loc.district || '';
  const logo = (pref.shopLogo || shop.avatar || '').trim();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalUrl = `${origin.replace(/\/$/, '')}/s/${shop.id}`;
  const description = `${shop.name} — ${items.length} ürün ve güncel fiyatlar${city ? ` (${city}${district ? ', ' + district : ''})` : ''}. ${pref.shopDescription || ''}`.trim();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <SeoHead
        title={`${shop.name} — ürünler ve fiyatlar`}
        description={description}
        canonicalUrl={canonicalUrl}
        imageUrl={logo || undefined}
      />

      <header style={{ marginBottom: 20 }}>
        {logo && <img src={logo} alt={shop.name} style={{ maxWidth: 96, height: 'auto', borderRadius: 10 }} />}
        <h1 style={{ fontSize: 28, margin: '12px 0 4px' }}>{shop.name}</h1>
        <div style={{ color: '#555', fontSize: 14 }}>
          {city && <div>📍 {city}{district ? ` / ${district}` : ''}</div>}
          {pref.shopAddress && <div>{pref.shopAddress}</div>}
          {pref.openingHours && <div>🕐 {pref.openingHours}</div>}
          {pref.phone && <div>📞 {pref.phone}</div>}
        </div>
      </header>

      {pref.shopDescription && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#333' }}>
          {pref.shopDescription}
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Ürünler ve fiyatlar</h2>
      {items.length === 0 ? (
        <p style={{ color: '#666' }}>Bu dükkanda henüz ürün kaydı yok.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ fontSize: 16 }}>
                {item.product_name}
                {item.unit && <span style={{ color: '#666', fontSize: 14, marginLeft: 6 }}>/ {item.unit}</span>}
              </span>
              <strong style={{ fontSize: 16, color: '#166534' }}>{Number(item.price).toFixed(2)} ₺</strong>
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
