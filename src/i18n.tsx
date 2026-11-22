import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Interface language (Portuguese / English).
 *
 * Texts are written inline as pairs — t('Pesquisa', 'Research') — so each screen stays
 * readable in its own file and a missing translation can never show an empty label.
 * Data written by people (study names, notes, messages) is never translated.
 */
export type Lang = 'pt' | 'en';

const STORAGE_KEY = 'african-analogs-lang';

function detectInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch {
    // storage blocked: fall back to the browser language
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav && !nav.toLowerCase().startsWith('pt') ? 'en' : 'pt';
}

// Module-level copy for code outside React (services, data helpers).
let currentLang: Lang = detectInitialLang();

export const getLang = (): Lang => currentLang;

/** Translation outside React components (reads the current language). */
export const tr = (pt: string, en: string): string => (currentLang === 'en' ? en : pt);

/** Locale for dates and numbers. */
export const getLocale = (): string => (currentLang === 'en' ? 'en-GB' : 'pt-PT');

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (pt: string, en: string) => string;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    setLangState(next);
  }, []);

  useEffect(() => {
    currentLang = lang;
    document.documentElement.lang = lang;
    const title = lang === 'en' ? 'African Analogs — Earth Sites That Resemble Other Worlds' : 'African Analogs — Lugares da Terra Parecidos com Planetas';
    const description = lang === 'en'
      ? 'Explore places in Africa and around the world that resemble Mars, the Moon and other worlds using photos, maps and AI.'
      : 'Explore lugares na África e no mundo parecidos com Marte, a Lua e outros planetas usando fotos, mapas e inteligência artificial.';
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (pt, en) => (lang === 'en' ? en : pt),
      locale: lang === 'en' ? 'en-GB' : 'pt-PT',
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
