// Calculator app logic. Safe expression evaluator (no Function/eval).

type TokenType = 'num' | 'op' | 'lparen' | 'rparen'
interface Token { type: TokenType; value: string }

const OP_PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  'u-': 3, // unary minus
}
const RIGHT_ASSOC = new Set<string>(['u-'])

function tokenize(expr: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (c === ' ') { i++; continue }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++
      out.push({ type: 'num', value: expr.slice(i, j) })
      i = j
      continue
    }
    if ('+-*/'.includes(c)) {
      // detect unary minus
      const prev = out[out.length - 1]
      if (c === '-' && (!prev || prev.type === 'op' || prev.type === 'lparen')) {
        out.push({ type: 'op', value: 'u-' })
      } else {
        out.push({ type: 'op', value: c })
      }
      i++
      continue
    }
    if (c === '(') { out.push({ type: 'lparen', value: c }); i++; continue }
    if (c === ')') { out.push({ type: 'rparen', value: c }); i++; continue }
    throw new Error('bad char: ' + c)
  }
  return out
}

function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = []
  const stack: Token[] = []
  for (const t of tokens) {
    if (t.type === 'num') { out.push(t); continue }
    if (t.type === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (top.type !== 'op') break
        const pTop = OP_PRECEDENCE[top.value]
        const pCur = OP_PRECEDENCE[t.value]
        if (pTop > pCur || (pTop === pCur && !RIGHT_ASSOC.has(t.value))) {
          out.push(stack.pop()!)
        } else break
      }
      stack.push(t)
      continue
    }
    if (t.type === 'lparen') { stack.push(t); continue }
    if (t.type === 'rparen') {
      while (stack.length && stack[stack.length - 1].type !== 'lparen') {
        out.push(stack.pop()!)
      }
      if (!stack.length) throw new Error('mismatched parens')
      stack.pop()
    }
  }
  while (stack.length) {
    const t = stack.pop()!
    if (t.type === 'lparen') throw new Error('mismatched parens')
    out.push(t)
  }
  return out
}

function evalRPN(rpn: Token[]): number {
  const stack: number[] = []
  for (const t of rpn) {
    if (t.type === 'num') { stack.push(parseFloat(t.value)); continue }
    if (t.value === 'u-') {
      const a = stack.pop()
      if (a === undefined) throw new Error('bad')
      stack.push(-a)
      continue
    }
    const b = stack.pop()
    const a = stack.pop()
    if (a === undefined || b === undefined) throw new Error('bad')
    switch (t.value) {
      case '+': stack.push(a + b); break
      case '-': stack.push(a - b); break
      case '*': stack.push(a * b); break
      case '/':
        if (b === 0) throw new Error('divide by zero')
        stack.push(a / b)
        break
    }
  }
  if (stack.length !== 1) throw new Error('bad')
  return stack[0]
}

export function evaluate(expr: string): number {
  const cleaned = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  const rpn = toRPN(tokenize(cleaned))
  const result = evalRPN(rpn)
  if (!isFinite(result)) throw new Error('overflow')
  return result
}

function clickTone() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.value = 0.04
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.04)
    setTimeout(() => ctx.close(), 100)
  } catch {}
}

export function mountCalculator(root: HTMLElement) {
  const prevEl = root.querySelector<HTMLElement>('.calc-prev')!
  const currEl = root.querySelector<HTMLElement>('.calc-current')!
  const keysEl = root.querySelector<HTMLElement>('.calc-keys')!

  let current = ''
  let previous = ''

  function render() {
    currEl.textContent = current || '0'
    prevEl.textContent = previous
  }

  function setError() {
    currEl.classList.add('error')
    current = 'Error'
    render()
  }

  function clearError() {
    currEl.classList.remove('error')
    if (current === 'Error') current = ''
  }

  function press(action: string, value?: string) {
    clearError()
    if (action === 'clear') { current = ''; previous = ''; render(); return }
    if (action === 'back') { current = current.slice(0, -1); render(); return }
    if (action === 'equals') {
      if (!current) return
      try {
        const r = evaluate(current)
        previous = current + ' ='
        current = formatNum(r)
        render()
      } catch { setError() }
      return
    }
    if (action === 'sign') {
      // Toggle sign on last number chunk
      const m = current.match(/(-?\d*\.?\d*)$/)
      if (!m || !m[1]) return
      const num = m[1]
      const before = current.slice(0, current.length - num.length)
      const toggled = num.startsWith('-') ? num.slice(1) : '-' + num
      current = before + toggled
      render()
      return
    }
    if (action === 'percent') {
      if (!current) return
      try {
        const r = evaluate(current) / 100
        current = formatNum(r)
        render()
      } catch { setError() }
      return
    }
    if (action === 'append' && value !== undefined) {
      // Prevent double decimal in trailing number
      if (value === '.') {
        const last = current.match(/(\d*\.?\d*)$/)
        if (last && last[1].includes('.')) return
      }
      current += value
      render()
      return
    }
  }

  function formatNum(n: number): string {
    if (Number.isInteger(n)) return String(n)
    return String(parseFloat(n.toFixed(10)))
  }

  keysEl.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!t) return
    clickTone()
    const action = t.dataset.action || 'append'
    press(action, t.dataset.value ?? t.textContent ?? undefined)
  })

  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest('input, textarea')) return
    const k = e.key
    if (/^[0-9]$/.test(k)) { press('append', k); e.preventDefault(); return }
    if (k === '.') { press('append', '.'); e.preventDefault(); return }
    if (k === '+' || k === '-' || k === '*' || k === '/') {
      press('append', k); e.preventDefault(); return
    }
    if (k === '(' || k === ')') { press('append', k); e.preventDefault(); return }
    if (k === '%') { press('percent'); e.preventDefault(); return }
    if (k === 'Enter' || k === '=') { press('equals'); e.preventDefault(); return }
    if (k === 'Backspace') { press('back'); e.preventDefault(); return }
    if (k === 'Escape' || k === 'c' || k === 'C') { press('clear'); e.preventDefault(); return }
  })

  render()
}
