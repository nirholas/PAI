import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const changelog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/changelog' }),
  schema: z.object({
    title: z.string(),
    date: z
      .union([z.string(), z.date()])
      .transform((v) => (v instanceof Date ? v : new Date(String(v)))),
    description: z.string().max(160).optional(),
    stable: z.boolean().default(true),
    githubUrl: z.string().url().optional(),
  }),
})

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    section: z.string().optional(),
    order: z.number().optional(),
    editPath: z.string().optional(),
  }),
})

const faq = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    order: z.number(),
  }),
})

export const collections = { changelog, docs, faq }
