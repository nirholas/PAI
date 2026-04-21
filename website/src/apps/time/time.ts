// Time app: clock, timer, stopwatch, alarms

const LS_ZONES = 'pai-time-zones'
const LS_ALARMS = 'pai-time-alarms'

interface Alarm { id: string; time: string; label: string; enabled: boolean }

function beep(duration = 0.3, freq = 880) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = freq
    o.type = 'sine'
    g.gain.value = 0.1
    o.connect(g).connect(ctx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    o.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000)
  } catch {}
}

const COMMON_ZONES: Array<{ label: string; tz: string }> = [
  { label: 'Local', tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
  { label: 'UTC', tz: 'UTC' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Berlin', tz: 'Europe/Berlin' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
  { label: 'Mumbai', tz: 'Asia/Kolkata' },
  { label: 'Shanghai', tz: 'Asia/Shanghai' },
  { label: 'Dubai', tz: 'Asia/Dubai' },
  { label: 'São Paulo', tz: 'America/Sao_Paulo' },
]

function loadJSON<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : def
  } catch { return def }
}
function saveJSON(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

function pad(n: number, w = 2) { return String(n).padStart(w, '0') }

function formatMs(ms: number) {
  if (ms < 0) ms = 0
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`
  return `${pad(m)}:${pad(s)}.${pad(cs)}`
}

export function mountTime(root: HTMLElement) {
  // ── Tab switching
  const tabs = root.querySelectorAll<HTMLButtonElement>('.time-tab')
  const panels = root.querySelectorAll<HTMLElement>('.time-panel')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab!
      tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'))
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target))
    })
  })

  // ── Clock
  const digital = root.querySelector<HTMLElement>('.clock-digital')!
  const date = root.querySelector<HTMLElement>('.clock-date')!
  const analog = root.querySelector<SVGSVGElement>('.clock-analog')!
  const hourHand = analog.querySelector<SVGLineElement>('#hour-hand')!
  const minHand = analog.querySelector<SVGLineElement>('#min-hand')!
  const secHand = analog.querySelector<SVGLineElement>('#sec-hand')!
  const zonesList = root.querySelector<HTMLElement>('.clock-zones')!
  const zonesSelect = root.querySelector<HTMLSelectElement>('.zone-select')!
  const zoneAddBtn = root.querySelector<HTMLButtonElement>('.zone-add-btn')!

  COMMON_ZONES.forEach((z) => {
    const opt = document.createElement('option')
    opt.value = z.tz
    opt.textContent = `${z.label} (${z.tz})`
    zonesSelect.appendChild(opt)
  })

  let zones: Array<{ tz: string; label: string }> = loadJSON(LS_ZONES, [
    { tz: 'UTC', label: 'UTC' },
    { tz: 'America/New_York', label: 'New York' },
  ])

  function renderZones() {
    zonesList.innerHTML = ''
    zones.forEach((z, i) => {
      const row = document.createElement('div')
      row.className = 'zone-row'
      const name = document.createElement('span')
      name.className = 'zone-name'
      name.textContent = z.label
      const time = document.createElement('span')
      time.className = 'zone-time'
      time.dataset.tz = z.tz
      const rm = document.createElement('button')
      rm.className = 'zone-remove'
      rm.textContent = '✕'
      rm.setAttribute('aria-label', `Remove ${z.label}`)
      rm.addEventListener('click', () => {
        zones.splice(i, 1)
        saveJSON(LS_ZONES, zones)
        renderZones()
      })
      row.append(name, time, rm)
      zonesList.appendChild(row)
    })
  }

  zoneAddBtn.addEventListener('click', () => {
    const tz = zonesSelect.value
    if (!tz) return
    const entry = COMMON_ZONES.find((z) => z.tz === tz)
    if (!entry) return
    if (zones.some((z) => z.tz === tz)) return
    zones.push({ tz, label: entry.label })
    saveJSON(LS_ZONES, zones)
    renderZones()
  })

  function tickClock() {
    const now = new Date()
    const hh = now.getHours()
    const mm = now.getMinutes()
    const ss = now.getSeconds()
    digital.textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}`
    date.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const hAngle = (hh % 12) * 30 + mm * 0.5
    const mAngle = mm * 6 + ss * 0.1
    const sAngle = ss * 6
    hourHand.setAttribute('transform', `rotate(${hAngle} 100 100)`)
    minHand.setAttribute('transform', `rotate(${mAngle} 100 100)`)
    secHand.setAttribute('transform', `rotate(${sAngle} 100 100)`)

    zonesList.querySelectorAll<HTMLElement>('.zone-time').forEach((el) => {
      const tz = el.dataset.tz!
      try {
        const fmt = new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
        el.textContent = fmt.format(now)
      } catch { el.textContent = '—' }
    })
  }
  renderZones()
  tickClock()
  setInterval(tickClock, 1000)

  // ── Timer
  const timerDisplay = root.querySelector<HTMLElement>('.timer-display')!
  const timerHInput = root.querySelector<HTMLInputElement>('.timer-h')!
  const timerMInput = root.querySelector<HTMLInputElement>('.timer-m')!
  const timerSInput = root.querySelector<HTMLInputElement>('.timer-s')!
  const timerStart = root.querySelector<HTMLButtonElement>('.timer-start')!
  const timerPause = root.querySelector<HTMLButtonElement>('.timer-pause')!
  const timerReset = root.querySelector<HTMLButtonElement>('.timer-reset')!

  let timerEnd = 0
  let timerRemaining = 0
  let timerRunning = false
  let timerInterval: number | null = null
  let timerRinging = false

  function updateTimerDisplay(ms: number) {
    const total = Math.max(0, Math.ceil(ms / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    timerDisplay.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`
  }

  function startTimer() {
    if (timerRinging) return
    if (!timerRunning) {
      if (timerRemaining <= 0) {
        const h = parseInt(timerHInput.value) || 0
        const m = parseInt(timerMInput.value) || 0
        const s = parseInt(timerSInput.value) || 0
        timerRemaining = (h * 3600 + m * 60 + s) * 1000
        if (timerRemaining <= 0) return
      }
      timerEnd = Date.now() + timerRemaining
      timerRunning = true
      timerInterval = window.setInterval(() => {
        const rem = timerEnd - Date.now()
        updateTimerDisplay(rem)
        if (rem <= 0) {
          if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
          timerRunning = false
          timerRemaining = 0
          ringTimer()
        }
      }, 100)
    }
  }

  function pauseTimer() {
    if (!timerRunning) return
    timerRemaining = Math.max(0, timerEnd - Date.now())
    timerRunning = false
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
  }

  function resetTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
    timerRunning = false
    timerRemaining = 0
    timerRinging = false
    timerDisplay.classList.remove('ringing')
    updateTimerDisplay(0)
  }

  function ringTimer() {
    timerRinging = true
    timerDisplay.classList.add('ringing')
    let count = 0
    const iv = window.setInterval(() => {
      beep(0.25, 880)
      count++
      if (count >= 5 || !timerRinging) { clearInterval(iv); timerRinging = false; timerDisplay.classList.remove('ringing') }
    }, 500)
  }

  timerStart.addEventListener('click', startTimer)
  timerPause.addEventListener('click', pauseTimer)
  timerReset.addEventListener('click', resetTimer)
  updateTimerDisplay(0)

  // ── Stopwatch
  const swDisplay = root.querySelector<HTMLElement>('.sw-display')!
  const swStart = root.querySelector<HTMLButtonElement>('.sw-start')!
  const swLap = root.querySelector<HTMLButtonElement>('.sw-lap')!
  const swReset = root.querySelector<HTMLButtonElement>('.sw-reset')!
  const swLaps = root.querySelector<HTMLElement>('.sw-laps')!

  let swStartTime = 0
  let swElapsed = 0
  let swRunning = false
  let swInterval: number | null = null
  let swLapCount = 0
  let swLastLap = 0

  function updateSw() {
    const total = swElapsed + (swRunning ? Date.now() - swStartTime : 0)
    swDisplay.textContent = formatMs(total)
  }

  swStart.addEventListener('click', () => {
    if (!swRunning) {
      swRunning = true
      swStartTime = Date.now()
      swStart.textContent = 'Pause'
      swInterval = window.setInterval(updateSw, 37)
    } else {
      swElapsed += Date.now() - swStartTime
      swRunning = false
      swStart.textContent = 'Start'
      if (swInterval) { clearInterval(swInterval); swInterval = null }
      updateSw()
    }
  })
  swLap.addEventListener('click', () => {
    if (!swRunning && swElapsed === 0) return
    const total = swElapsed + (swRunning ? Date.now() - swStartTime : 0)
    const lapTime = total - swLastLap
    swLastLap = total
    swLapCount++
    const row = document.createElement('div')
    row.className = 'lap-row'
    row.innerHTML = `<span>Lap ${swLapCount}</span><span>${formatMs(lapTime)}</span><span>${formatMs(total)}</span>`
    swLaps.prepend(row)
  })
  swReset.addEventListener('click', () => {
    if (swInterval) { clearInterval(swInterval); swInterval = null }
    swRunning = false
    swElapsed = 0
    swStartTime = 0
    swLastLap = 0
    swLapCount = 0
    swStart.textContent = 'Start'
    swLaps.innerHTML = ''
    updateSw()
  })
  updateSw()

  // ── Alarms
  const alarmTimeInp = root.querySelector<HTMLInputElement>('.alarm-time-input')!
  const alarmLabelInp = root.querySelector<HTMLInputElement>('.alarm-label-input')!
  const alarmAddBtn = root.querySelector<HTMLButtonElement>('.alarm-add-btn')!
  const alarmList = root.querySelector<HTMLElement>('.alarm-list')!

  let alarms: Alarm[] = loadJSON(LS_ALARMS, [])
  const triggeredThisMinute = new Set<string>()

  function renderAlarms() {
    alarmList.innerHTML = ''
    alarms.forEach((a) => {
      const row = document.createElement('div')
      row.className = 'alarm-row' + (a.enabled ? '' : ' disabled')
      row.dataset.id = a.id

      const timeL = document.createElement('span')
      timeL.className = 'time-label'
      timeL.textContent = a.time

      const label = document.createElement('span')
      label.className = 'alarm-label-text'
      label.textContent = a.label || '(no label)'

      const toggle = document.createElement('input')
      toggle.type = 'checkbox'
      toggle.checked = a.enabled
      toggle.addEventListener('change', () => {
        a.enabled = toggle.checked
        saveJSON(LS_ALARMS, alarms)
        renderAlarms()
      })

      const del = document.createElement('button')
      del.className = 'btn'
      del.textContent = 'Remove'
      del.addEventListener('click', () => {
        alarms = alarms.filter((x) => x.id !== a.id)
        saveJSON(LS_ALARMS, alarms)
        renderAlarms()
      })

      row.append(timeL, label, toggle, del)
      alarmList.appendChild(row)
    })
  }

  alarmAddBtn.addEventListener('click', () => {
    const t = alarmTimeInp.value
    if (!t) return
    alarms.push({ id: Math.random().toString(36).slice(2), time: t, label: alarmLabelInp.value.trim(), enabled: true })
    saveJSON(LS_ALARMS, alarms)
    alarmLabelInp.value = ''
    renderAlarms()
  })

  function checkAlarms() {
    const now = new Date()
    const hh = pad(now.getHours())
    const mm = pad(now.getMinutes())
    const cur = `${hh}:${mm}`
    const keyNow = `${cur}:${now.getDate()}`
    // reset triggered set each minute
    for (const k of Array.from(triggeredThisMinute)) {
      if (!k.startsWith(cur)) triggeredThisMinute.delete(k)
    }
    alarms.forEach((a) => {
      if (!a.enabled) return
      if (a.time === cur && !triggeredThisMinute.has(`${keyNow}:${a.id}`)) {
        triggeredThisMinute.add(`${keyNow}:${a.id}`)
        fireAlarm(a)
      }
    })
  }

  function fireAlarm(a: Alarm) {
    const row = alarmList.querySelector<HTMLElement>(`[data-id="${a.id}"]`)
    if (row) row.classList.add('firing')
    let count = 0
    const iv = window.setInterval(() => {
      beep(0.3, count % 2 === 0 ? 880 : 660)
      count++
      if (count >= 10) {
        clearInterval(iv)
        if (row) row.classList.remove('firing')
      }
    }, 400)
  }

  renderAlarms()
  setInterval(checkAlarms, 1000)
}
