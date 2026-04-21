import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

// Build-time feed powering the Start menu's "Recommended" section.
// Combines the most recent changelog entries with a curated set of docs so the
// menu reflects real content instead of placeholders.

type RecentItem = {
  kind: 'changelog' | 'docs'
  id: string
  title: string
  description: string
  date?: string
}

const DOCS_ORDER: readonly string[] = [
  'overview',
  'getting-started',
  'security-model',
  'usb-flashing',
  'architecture',
  'persistence',
  'troubleshooting',
]

export const GET: APIRoute = async () => {
  const [changelog, docs] = await Promise.all([
    getCollection('changelog'),
    getCollection('docs'),
  ])

  const changelogItems: RecentItem[] = changelog
    .slice()
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 3)
    .map((e) => ({
      kind: 'changelog',
      id: e.id,
      title: e.data.title,
      description: e.data.description ?? '',
      date: e.data.date.toISOString(),
    }))

  const docsById = new Map(docs.map((d) => [d.id, d]))
  const orderedDocs: RecentItem[] = DOCS_ORDER
    .map((id) => docsById.get(id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .slice(0, 4)
    .map((d) => ({
      kind: 'docs',
      id: d.id,
      title: d.data.title,
      description: d.data.description ?? '',
    }))

  const payload = {
    changelog: changelogItems,
    docs: orderedDocs,
  }

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  })
}
