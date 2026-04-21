import type { APIRoute } from 'astro'
import { renderOg } from './_og.ts'

export const GET: APIRoute = () => {
  return renderOg('PAI', 'Private, offline AI on a bootable USB drive.')
}
