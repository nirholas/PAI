import { getEnvInfo } from '../../env.ts'

export const description = 'Show browser-visible network state'

export default function ip(args, _term) {
  const sub = args[0] || 'a'
  if (sub !== 'a' && sub !== 'addr' && sub !== 'link') {
    return `ip: unsupported subcommand '${sub}'\nUsage: ip [a|addr|link]`
  }

  const env = getEnvInfo()
  const c = env.connection

  const lines = []
  lines.push(
    '<span class="t-dim"># Browser-sandboxed: OS interfaces aren\'t visible to the web preview.</span>',
    '<span class="t-dim"># Real PAI exposes full `ip addr` via the live-USB shell.</span>',
    '',
  )

  lines.push(
    '1: lo: &lt;LOOPBACK,UP,LOWER_UP&gt; mtu 65536 state UNKNOWN',
    '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00',
    '    inet 127.0.0.1/8 scope host lo',
  )

  const state = env.online ? 'UP' : 'DOWN'
  const typeTag = c.type ? c.type.toUpperCase() : 'UNKNOWN'
  lines.push(
    '',
    `2: net0: &lt;BROADCAST,${typeTag},${state}&gt; state ${state}`,
    `    <span class="t-dim"># ${env.online ? 'online' : 'offline'} — reported by navigator.onLine</span>`,
  )

  if (c.effectiveType) {
    lines.push(
      `    effective-type ${c.effectiveType}` +
        (c.downlinkMbps != null ? `  downlink ${c.downlinkMbps} Mbps` : '') +
        (c.rttMs != null ? `  rtt ${c.rttMs} ms` : ''),
    )
  } else {
    lines.push(
      '    <span class="t-dim"># Network Information API not exposed by this browser</span>',
    )
  }
  if (c.saveData) {
    lines.push('    data-saver: on')
  }

  return lines.join('\n')
}
