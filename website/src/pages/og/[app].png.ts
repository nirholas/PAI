import type { APIRoute, GetStaticPaths } from 'astro'
import { APPS } from '../../shell/apps.js'
import { renderOg } from './_og.ts'

export const getStaticPaths: GetStaticPaths = () => {
  return Object.keys(APPS).map((id) => ({ params: { app: id } }))
}

export const GET: APIRoute = ({ params }) => {
  const id = params.app as string
  const app = (APPS as Record<string, { title: string; description: string }>)[id]
  if (!app) return new Response('Not found', { status: 404 })
  return renderOg(app.title, app.description)
}
