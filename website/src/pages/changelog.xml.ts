import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const entries = await getCollection('changelog')
  const sorted = entries.sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  )

  return rss({
    title: 'PAI Changelog',
    description: 'Release notes and updates for PAI — Private AI on a bootable USB drive.',
    site: context.site!,
    items: sorted.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.date,
      description: entry.data.description,
      link: `/apps/changelog/`,
    })),
    customData: '<language>en-us</language>',
  })
}
