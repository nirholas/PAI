// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'

// https://astro.build/config

export default defineConfig({
  site: 'https://pai.direct',

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
      wrap: false,
    },
  },

  integrations: [
    mdx(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        const url = new URL(item.url)
        if (url.pathname === '/') item.priority = 1.0
        else if (/^\/(apps\/(flash|how-it-works|about|faq|install)|install|how-pai-works)\/?$/.test(url.pathname)) item.priority = 0.9
        return item
      },
    }),
  ],

  // Clean URL redirects: /flash → /apps/flash etc.
  redirects: {
    '/about':     '/apps/about',
    '/docs':      '/apps/docs',
    '/flash':     '/apps/flash',
    '/terminal':  '/apps/terminal',
    '/chat':      '/apps/chat',
    '/security':  '/apps/security',
    '/verify':    '/apps/verify',
    '/hardware':  '/apps/hardware',
    '/press':     '/apps/press',
    '/changelog': '/apps/changelog',
    '/faq':       '/apps/faq',
    '/files':     '/apps/files',
  },
})
