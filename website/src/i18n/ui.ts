import { defaultLocale, locales, rtlLocales } from './config'

export { defaultLocale, locales, rtlLocales }

export const languageNames: Record<string, string> = {
  'en': 'English',
  'es': 'Español',
  'pt-BR': 'Português (Brasil)',
  'zh-Hans': '简体中文',
  'ar': 'العربية',
  'fr': 'Français',
  'de': 'Deutsch',
  'ja': '日本語',
  'ru': 'Русский',
}

export const ui = {
  'en': {
    'nav.about': 'About',
    'nav.docs': 'Docs',
    'nav.flash': 'Flash',
    'nav.faq': 'FAQ',
    'nav.download': 'Download',
    'nav.changelog': 'Changelog',
    'tagline': 'Private, offline AI on a USB stick.',
    'cta.get': 'Get PAI',
    'language.switch': 'Language',
  },
  'es': {
    'nav.about': 'Acerca',
    'nav.docs': 'Documentación',
    'nav.flash': 'Grabar',
    'nav.faq': 'Preguntas',
    'nav.download': 'Descargar',
    'nav.changelog': 'Cambios',
    'tagline': 'IA privada y sin conexión en una memoria USB.',
    'cta.get': 'Obtener PAI',
    'language.switch': 'Idioma',
  },
} as const

export type UIKey = keyof (typeof ui)['en']

export function getLocale(url: URL): string {
  const seg = url.pathname.split('/').filter(Boolean)[0]
  return (locales as readonly string[]).includes(seg) ? seg : defaultLocale
}

export function t(locale: string, key: UIKey): string {
  const bundle = (ui as Record<string, Partial<Record<UIKey, string>>>)[locale]
  return bundle?.[key] ?? ui[defaultLocale][key]
}

export function isRTL(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale)
}

export function localizedPath(locale: string, path: string): string {
  const clean = path.startsWith('/') ? path : '/' + path
  if (locale === defaultLocale) return clean
  return `/${locale}${clean === '/' ? '' : clean}`
}
