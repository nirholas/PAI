// Sort + filter engine for Hardware.app.

const STATUS_RANK = { works: 0, partial: 1, broken: 2 }

/**
 * @param {object[]} rows
 * @param {{ vendor: string, status: string, arch: string, q: string }} filters
 * @param {{ key: string, dir: 'asc'|'desc' }} sort
 * @returns {object[]}
 */
export function filterAndSort(rows, filters, sort) {
  let out = rows.filter((r) => {
    if (filters.vendor && r.vendor.toLowerCase() !== filters.vendor.toLowerCase()) return false
    if (filters.status && r.status !== filters.status) return false
    if (filters.arch && r.arch !== filters.arch) return false
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const haystack = `${r.vendor} ${r.model} ${r.notes} ${r.reporter}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  out = [...out].sort((a, b) => {
    let av = a[sort.key] ?? ''
    let bv = b[sort.key] ?? ''

    if (sort.key === 'status') {
      av = STATUS_RANK[av] ?? 9
      bv = STATUS_RANK[bv] ?? 9
      return sort.dir === 'asc' ? av - bv : bv - av
    }

    if (sort.key === 'lastTested') {
      av = new Date(av).getTime() || 0
      bv = new Date(bv).getTime() || 0
      return sort.dir === 'asc' ? av - bv : bv - av
    }

    av = String(av).toLowerCase()
    bv = String(bv).toLowerCase()
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sort.dir === 'asc' ? cmp : -cmp
  })

  return out
}

/** @param {'works'|'partial'|'broken'} status @returns {string} */
export function statusBadge(status) {
  const map = { works: '✅ Works', partial: '⚠ Partial', broken: '❌ Broken' }
  return map[status] ?? status
}

/** @param {'works'|'partial'|'broken'} val @returns {string} */
export function cellBadge(val) {
  const map = { works: '✅', partial: '⚠', broken: '❌', '': '—' }
  return map[val] ?? val
}
