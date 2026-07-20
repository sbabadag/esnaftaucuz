import React, { createContext, useContext, useState, ReactNode } from 'react';

type Lang = 'tr' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  tr: {
    HERO_SUB: 'En iyi fiyatları keşfet',
    SEARCH_PLACEHOLDER: 'ara...',
    TREND_TITLE: 'Bugün en çok bakılanlar',
    NO_TREND: 'Henüz trend ürün yok',
    RECENT_PRICES_TITLE: 'Son eklenen fiyatlar',
    NO_RECENT_PRICES: 'Henüz fiyat verisi bulunamadı',
    NEARBY_CHEAPEST_TITLE: 'Sana yakın en ucuz',
    EXPLORE: 'Keşfet',
    MAP: 'Harita',
    ADD: 'Ekle',
    PROFILE: 'Profil',
    MY_SHOP: 'Dükkanım',
    REPORTS: 'Raporlar',
    STORES_TITLE: 'Esnaf dükkanları',
    SHOP_BADGE: 'Dükkan',
    VIEW_MERCHANT_PRODUCTS: 'Esnaf ürünlerini görüntüle',
    MERCHANT_FALLBACK: 'Esnaf',
    PRODUCT_FALLBACK: 'Ürün',
    LOCATION_MISSING: 'Konum bilgisi yok',
    GO_TO_LOCATION: 'Konuma git',
    VERIFIED: 'Doğrulanmış',
    LOADING: 'Yükleniyor...',
    REFRESHED: 'Yenilendi',
    FILTER_APPLY: 'Filtreyi Uygula',
    CLEAR: 'Temizle',
    SEARCHING: 'Aranıyor...',
    SEARCH_RESULTS: 'Arama sonuçları: "{q}"',
    NO_RESULTS_TITLE: 'Sonuç bulunamadı',
    NO_RESULTS_DESC: '"{q}" için arama sonucu bulunamadı. Farklı bir terim deneyin.',
    FAVORITES_TITLE: 'Favorilerim',
    MUST_LOGIN_TO_VIEW_FAVORITES: 'Favorileri görmek için giriş yapmanız gerekiyor',
    FAVORITES_LOAD_ERROR: 'Favoriler yüklenemedi',
    FAVORITE_REMOVED: 'Favorilerden kaldırıldı',
    FAVORITE_REMOVE_ERROR: 'Favoriden kaldırılamadı',
    NO_FAVORITES_TITLE: 'Henüz favori ürününüz yok',
    NO_FAVORITES_DESC: 'Beğendiğiniz ürünleri favorilerinize ekleyerek kolayca erişebilirsiniz',
    EXPLORE_PRODUCTS: 'Ürünleri Keşfet',
    LOGOUT_SUCCESS: 'Çıkış yapıldı',
    LOGOUT_ERROR: 'Çıkış yapılırken bir hata oluştu',
    LEVEL_LABEL: 'Seviye:',
    LEVEL_NEW: 'Yeni',
    LEVEL_NEIGHBOR: 'Mahalleli',
    LEVEL_EXPERT: 'Uzman',
    LEVEL_MASTER: 'Master',
    LEVEL_LEGEND: 'Efsane',
    SHARES: 'Paylaşım',
    VERIFICATIONS: 'Doğrulama',
    POINTS: 'Puan',
    BADGES: 'Rozetler',
    SETTINGS: 'Ayarlar',
    FEEDBACK_AND_SUPPORT: 'Destek & Geri Bildirim',
    THEME: 'Tema',
    DARK: 'Koyu',
    LIGHT: 'Açık',
    LANGUAGE: 'Dil',
    LANG_CHANGED: 'Dil değiştirildi',
    LOGIN: 'Giriş Yap',
    CONTRIBUTIONS: 'Katkılarım',
    CONTRIBUTIONS_TITLE: 'Girilen Ürünler',
    CONTRIBUTIONS_LOAD_ERROR: 'Katkılar yüklenemedi',
    UNKNOWN_PRODUCT: 'Bilinmeyen ürün',
    UNKNOWN_LOCATION: 'Bilinmeyen konum',
    PHOTO_MISSING: 'Bu fiyat için fotoğraf eklenmemiş',
    NO_CONTRIBUTIONS_TITLE: 'Henüz fiyat girilmemiş',
    NO_CONTRIBUTIONS_DESC: 'İlk fiyatınızı eklemek için "Ekle" sekmesine gidin',
    TODAY: 'BUGÜN',
    SYSTEM: 'Sistem',
    THEME_SAVED: 'Tema kaydedildi',
    SAVE: 'Kaydet',
  },
  en: {
    HERO_SUB: 'Discover the best prices',
    SEARCH_PLACEHOLDER: 'search...',
    TREND_TITLE: 'Most viewed today',
    NO_TREND: 'No trending products yet',
    RECENT_PRICES_TITLE: 'Recently added prices',
    NO_RECENT_PRICES: 'No price data found yet',
    NEARBY_CHEAPEST_TITLE: 'Cheapest near you',
    EXPLORE: 'Explore',
    MAP: 'Map',
    ADD: 'Add',
    PROFILE: 'Profile',
    MY_SHOP: 'My shop',
    REPORTS: 'Reports',
    STORES_TITLE: 'Merchant shops',
    SHOP_BADGE: 'Shop',
    VIEW_MERCHANT_PRODUCTS: 'View merchant products',
    MERCHANT_FALLBACK: 'Merchant',
    PRODUCT_FALLBACK: 'Product',
    LOCATION_MISSING: 'No location info',
    GO_TO_LOCATION: 'Go to location',
    VERIFIED: 'Verified',
    LOADING: 'Loading...',
    REFRESHED: 'Refreshed',
    FILTER_APPLY: 'Apply filter',
    CLEAR: 'Clear',
    SEARCHING: 'Searching...',
    SEARCH_RESULTS: 'Search results: "{q}"',
    NO_RESULTS_TITLE: 'No results',
    NO_RESULTS_DESC: 'No results found for "{q}". Try a different term.',
    FAVORITES_TITLE: 'My favorites',
    MUST_LOGIN_TO_VIEW_FAVORITES: 'You need to log in to view favorites',
    FAVORITES_LOAD_ERROR: 'Failed to load favorites',
    FAVORITE_REMOVED: 'Removed from favorites',
    FAVORITE_REMOVE_ERROR: 'Could not remove from favorites',
    NO_FAVORITES_TITLE: "You don't have favorite products yet",
    NO_FAVORITES_DESC: 'Add products you like to your favorites for quick access',
    EXPLORE_PRODUCTS: 'Explore products',
    LOGOUT_SUCCESS: 'Logged out',
    LOGOUT_ERROR: 'An error occurred during logout',
    LEVEL_LABEL: 'Level:',
    LEVEL_NEW: 'New',
    LEVEL_NEIGHBOR: 'Neighbor',
    LEVEL_EXPERT: 'Expert',
    LEVEL_MASTER: 'Master',
    LEVEL_LEGEND: 'Legend',
    SHARES: 'Shares',
    VERIFICATIONS: 'Verifications',
    POINTS: 'Points',
    BADGES: 'Badges',
    SETTINGS: 'Settings',
    FEEDBACK_AND_SUPPORT: 'Support & Feedback',
    THEME: 'Theme',
    DARK: 'Dark',
    LIGHT: 'Light',
    LANGUAGE: 'Language',
    LANG_CHANGED: 'Language changed',
    LOGIN: 'Log in',
    CONTRIBUTIONS: 'Contributions',
    SYSTEM: 'System',
    THEME_SAVED: 'Theme saved',
    SAVE: 'Save',
    CONTRIBUTIONS_TITLE: 'Contributions',
    CONTRIBUTIONS_LOAD_ERROR: 'Failed to load contributions',
    UNKNOWN_PRODUCT: 'Unknown product',
    UNKNOWN_LOCATION: 'Unknown location',
    PHOTO_MISSING: 'No photo was added for this price',
    NO_CONTRIBUTIONS_TITLE: 'No prices yet',
    NO_CONTRIBUTIONS_DESC: 'Go to the "Add" tab to add your first price',
    TODAY: 'TODAY',
  },
};

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string>) => string;
} | undefined>(undefined);

const LANG_USER_SET_KEY = 'lang-user-set';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const getInitial = (): Lang => {
    try {
      const userSet = localStorage.getItem(LANG_USER_SET_KEY) === '1';
      const stored = localStorage.getItem('lang');
      // Only honor saved language after an explicit user choice (TR/EN toggle).
      // Device locale (often en-US on emulators) must not mix the UI.
      if (userSet && (stored === 'en' || stored === 'tr')) return stored;
      localStorage.setItem('lang', 'tr');
    } catch (e) {
      // ignore
    }
    return 'tr';
  };

  const [lang, setLangState] = useState<Lang>(getInitial);

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem(LANG_USER_SET_KEY, '1');
      localStorage.setItem('lang', l);
    } catch (e) {
      // ignore
    }
    setLangState(l);
  };

  const t = (key: string, vars?: Record<string, string>) => {
    const dict = translations[lang] || translations.tr;
    let str = dict[key] || translations.tr[key] || key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(`{${k}}`, vars[k]);
      }
    }
    return str;
  };

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

