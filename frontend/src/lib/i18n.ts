import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from '../locales/en.json';
import hiTranslations from '../locales/hi.json';

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      hi: { translation: hiTranslations },
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
  });

export default i18n;
