import { useEffect } from 'react';

/**
 * Hafif SEO head yöneticisi — document.head'i doğrudan yönetir.
 * Bağımlılık gerektirmez (react-helmet yok). Ürün sayfalarında dinamik
 * title, description, canonical, OG etiketleri ve JSON-LD enjekte eder.
 */

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalUrl?: string;
  imageUrl?: string;
  ogType?: string;
  /** JSON-LD structured data nesnesi */
  jsonLd?: Record<string, unknown>;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id: string, jsonLd: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(jsonLd);
}

export default function SeoHead({
  title,
  description,
  canonicalUrl,
  imageUrl,
  ogType = 'website',
  jsonLd,
}: SeoHeadProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.title = title;
    if (description) {
      upsertMeta('name', 'description', description);
    }
    if (canonicalUrl) {
      upsertLink('canonical', canonicalUrl);
    }

    // Open Graph
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:type', ogType);
    if (description) upsertMeta('property', 'og:description', description);
    if (canonicalUrl) upsertMeta('property', 'og:url', canonicalUrl);
    if (imageUrl) upsertMeta('property', 'og:image', imageUrl);

    // Twitter
    upsertMeta('name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title);
    if (description) upsertMeta('name', 'twitter:description', description);
    if (imageUrl) upsertMeta('name', 'twitter:image', imageUrl);

    if (jsonLd) {
      upsertJsonLd('seo-product-jsonld', jsonLd);
    }
  }, [title, description, canonicalUrl, imageUrl, ogType, jsonLd]);

  return null;
}
