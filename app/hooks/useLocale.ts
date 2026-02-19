import { useEffect, useMemo, useState } from 'react';

type Strings = Record<string, string>;

export function useLocale() {
  const [locale, setLocale] = useState<string>(() => {
    try {
      return localStorage.getItem('locale') || 'tr';
    } catch {
      return 'tr';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('locale', locale); } catch {}
  }, [locale]);

  const strings: Strings = useMemo(() => {
    try {
      // Try to load JSON files synchronously via require (bundler will handle)
      // Fallback to simple inline defaults if not available.
      // Note: components should re-render when locale changes.
      // Keep this lightweight scaffold for now.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const msgs = require('../../i18n/' + locale + '.json');
      return msgs || {};
    } catch {
      return {};
    }
  }, [locale]);

  const t = (key: string, fallback?: string) => {
    return strings[key] || fallback || key;
  };

  return { locale, setLocale, t };
}

