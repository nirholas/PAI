export const locales = ['en', 'es', 'pt-BR', 'zh-Hans', 'ar', 'fr', 'de', 'ja', 'ru'] as const
export const defaultLocale = 'en'
export const rtlLocales = ['ar'] as const
export type Locale = (typeof locales)[number]
