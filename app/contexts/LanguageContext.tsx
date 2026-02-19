import React, { createContext, useContext, useState, ReactNode } from 'react';

type Lang = 'tr' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  tr: {
    HERO_SUB: 'En iyi fiyatları keşfet',
    SEARCH_PLACEHOLDER: 'ara...',
    TREND_TITLE: 'Bugün en çok bakılanlar',
    EXPLORE: 'Keşfet',
    MAP: 'Harita',
    ADD: 'Ekle',
    PROFILE: 'Profil',
    MY_SHOP: 'Dükkanım',
    STORES_TITLE: 'Esnaf Dükkanları',
    LOADING: 'Yükleniyor...',
    REFRESHED: 'Yenilendi',
    FILTER_APPLY: 'Filtreyi Uygula',
    CLEAR: 'Temizle',
    SEARCHING: 'Aranıyor...',
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
  },
  en: {
    HERO_SUB: 'Discover the best prices',
    SEARCH_PLACEHOLDER: 'search...',
    TREND_TITLE: 'Most viewed today',
    EXPLORE: 'Explore',
    MAP: 'Map',
    ADD: 'Add',
    PROFILE: 'Profile',
    MY_SHOP: 'My shop',
    STORES_TITLE: 'Shops',
    LOADING: 'Loading...',
    REFRESHED: 'Refreshed',
    FILTER_APPLY: 'Apply filter',
    CLEAR: 'Clear',
    SEARCHING: 'Searching...',
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
    SYSTEM: 'Sistem',
    THEME_SAVED: 'Tema kaydedildi',
    SAVE: 'Kaydet',
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const getInitial = (): Lang => {
    try {
      const stored = localStorage.getItem('lang');
      if (stored === 'en' || stored === 'tr') return stored;
    } catch (e) {
      // ignore
    }
    return (navigator.language || 'tr').startsWith('en') ? 'en' : 'tr';
  };

  const [lang, setLangState] = useState<Lang>(getInitial);

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem('lang', l);
    } catch (e) {
      // ignore
    }
    setLangState(l);
  };

  const t = (key: string, vars?: Record<string, string>) => {
    const dict = translations[lang] || translations.tr;
    let str = dict[key] || key;
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

