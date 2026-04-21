import { ImageResponse } from '@vercel/og'

type Node = {
  type: string
  props: Record<string, unknown> & { children?: unknown }
}

function h(
  type: string,
  props: Record<string, unknown> = {},
  ...children: unknown[]
): Node {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false)
  return {
    type,
    props: {
      ...props,
      children: kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids,
    },
  }
}

const BG = '#0a0a0f'
const BLUE = '#7aa2f7'
const WHITE = '#ffffff'
const MUTED = '#8b8fa8'
const GRID = 'rgba(122, 162, 247, 0.06)'

export function renderOg(title: string, description: string): Response {
  const gridSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">` +
    `<defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">` +
    `<path d="M 40 0 L 0 0 0 40" fill="none" stroke="${GRID}" stroke-width="1"/>` +
    `</pattern></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `</svg>`
  const gridUrl = `data:image/svg+xml;base64,${Buffer.from(gridSvg).toString('base64')}`

  const element = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: BG,
        backgroundImage: `url(${gridUrl})`,
        fontFamily: 'sans-serif',
        color: WHITE,
        position: 'relative',
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center' } },
      h(
        'div',
        {
          style: {
            fontSize: '48px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: WHITE,
            display: 'flex',
          },
        },
        'PAI',
      ),
      h(
        'div',
        {
          style: {
            width: '10px',
            height: '10px',
            borderRadius: '999px',
            background: BLUE,
            marginLeft: '16px',
            marginTop: '18px',
          },
        },
      ),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', maxWidth: '1000px' } },
      h(
        'div',
        {
          style: {
            fontSize: '84px',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: WHITE,
            display: 'flex',
          },
        },
        title,
      ),
      h(
        'div',
        {
          style: {
            marginTop: '28px',
            fontSize: '30px',
            lineHeight: 1.35,
            color: MUTED,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          },
        },
        description,
      ),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        },
      },
      h(
        'div',
        {
          style: {
            width: '80px',
            height: '4px',
            background: BLUE,
            display: 'flex',
          },
        },
      ),
      h(
        'div',
        {
          style: {
            fontSize: '22px',
            color: MUTED,
            display: 'flex',
            letterSpacing: '0.02em',
          },
        },
        'pai.direct',
      ),
    ),
  )

  return new ImageResponse(element as never, {
    width: 1200,
    height: 630,
  })
}
