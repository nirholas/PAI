import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

export const GET: APIRoute = async () => {
  const docs = await getCollection('docs')
  const index = docs.map((doc) => ({
    id: doc.id,
    title: doc.data.title,
    section: doc.data.section ?? '',
    description: doc.data.description ?? '',
    excerpt: ((doc.body ?? '') as string)
      .slice(0, 800)
      .replace(/^---[\s\S]*?---/, '')
      .replace(/[#*`\[\]<>]/g, '')
      .replace(/\n+/g, ' ')
      .trim(),
  }))
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  })
}
