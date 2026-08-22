import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'dan-fuel-log'
const SLOT_COUNT = 35
const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function emptySlot() {
  return { value: '', kind: 'use' }
}

function emptyDay() {
  return {
    start: '',
    slots: Array.from({ length: SLOT_COUNT }, emptySlot),
  }
}

function emptyWeek() {
  return Object.fromEntries(DAYS.map((day) => [day, emptyDay()]))
}

function normalizeSlot(raw) {
  if (raw && typeof raw === 'object') {
    return {
      value: String(raw.value ?? ''),
      kind: raw.kind === 'refill' ? 'refill' : 'use',
    }
  }

  return { value: String(raw ?? ''), kind: 'use' }
}

function loadWeek() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyWeek()

    const saved = JSON.parse(raw)
    const week = Object.fromEntries(
      DAYS.map((day) => {
        const entry = saved[day] ?? emptyDay()
        const slots = Array.from({ length: SLOT_COUNT }, (_, index) =>
          normalizeSlot(entry.slots?.[index]),
        )
        return [day, { start: String(entry.start ?? ''), slots }]
      }),
    )
    const sharedStart =
      DAYS.map((day) => week[day].start).find((value) => value.trim() !== '') ??
      ''

    if (!sharedStart) return week

    return Object.fromEntries(
      DAYS.map((day) => [day, { ...week[day], start: sharedStart }]),
    )
  } catch {
    return emptyWeek()
  }
}

function parseLitres(value) {
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) ? amount : 0
}

function formatLitres(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function slotTotals(slots) {
  return slots.reduce(
    (totals, slot) => {
      const amount = parseLitres(slot.value)
      if (slot.kind === 'refill') totals.refilled += amount
      else totals.used += amount
      return totals
    },
    { used: 0, refilled: 0 },
  )
}

function weekBalances(week) {
  return Object.fromEntries(
    DAYS.map((name) => {
      const hasStart = week[name].start.trim() !== ''
      const start = hasStart ? parseLitres(week[name].start) : null
      const { used, refilled } = slotTotals(week[name].slots)
      const remaining = start === null ? null : start - used + refilled
      return [name, { start, used, refilled, remaining }]
    }),
  )
}

function App() {
  const [week, setWeek] = useState(loadWeek)
  const [day, setDay] = useState('Monday')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const sheet = week[day]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(week))
  }, [week])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') setConfirmingClear(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const balances = useMemo(() => weekBalances(week), [week])
  const { start, used, refilled, remaining } = balances[day]
  const hasStart = start !== null

  function updateDay(name, patch) {
    setWeek((current) => ({
      ...current,
      [name]: { ...current[name], ...patch },
    }))
  }

  function setSharedStart(value) {
    setWeek((current) =>
      Object.fromEntries(
        DAYS.map((name) => [name, { ...current[name], start: value }]),
      ),
    )
  }

  function updateSlot(index, patch) {
    updateDay(day, {
      slots: sheet.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    })
  }

  function clearSlots() {
    updateDay(day, { slots: emptyDay().slots })
    setConfirmingClear(false)
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <h1 className="title">Running Tank Tally</h1>
          <p className="date">{day}</p>
        </div>
      </header>

      <main className="shell">
        <div className="balances">
          <label className="balance">
            <span>Starting balance</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={sheet.start}
              onChange={(event) => setSharedStart(event.target.value)}
              placeholder="Enter The Tank capacity in litres here..."
              aria-label="Starting balance for every day"
            />
          </label>
        </div>

        <p className="balance running" aria-live="polite">
          <span>Running balance</span>
          <strong className={hasStart && remaining < 0 ? 'low' : undefined}>
            {hasStart ? `${formatLitres(remaining)} L` : '—'}
          </strong>
        </p>

        <nav className="days" aria-label="Days of the week">
          {DAYS.map((name) => (
            <button
              key={name}
              type="button"
              className={name === day ? 'day active' : 'day'}
              onClick={() => {
                setDay(name)
                setConfirmingClear(false)
              }}
              aria-current={name === day ? 'page' : undefined}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </nav>

        <section className="summary">
          <p>
            <span>Total litres delivered</span>
            <strong>{formatLitres(used)} L</strong>
          </p>
          <p>
            <span>Refilled</span>
            <strong>{formatLitres(refilled)} L</strong>
          </p>
        </section>

        <section className="sheet" aria-label={`${day} fuel slots`}>
          <p className="sheet-label">{day} · 35 slots</p>
          <div className="grid">
            {sheet.slots.map((slot, index) => (
              <Slot
                key={index}
                number={index + 1}
                slot={slot}
                onChangeValue={(value) => updateSlot(index, { value })}
                onToggleRefill={() =>
                  updateSlot(index, {
                    kind: slot.kind === 'refill' ? 'use' : 'refill',
                  })
                }
              />
            ))}
          </div>
        </section>

        <button
          type="button"
          className="clear"
          onClick={() => {
            setConfirmingClear(true)
          }}
        >
          Clear {day}
        </button>
      </main>

      {confirmingClear ? (
        <div
          className="dialog-backdrop"
          onClick={() => setConfirmingClear(false)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="clear-title">Clear {day}?</h2>
            <p>
              This wipes the 35 slots for {day}. The starting balance stays
              put.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-cancel"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dialog-confirm"
                onClick={clearSlots}
              >
                Clear slots
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Slot({ number, slot, onChangeValue, onToggleRefill }) {
  const isRefill = slot.kind === 'refill'

  return (
    <div className={isRefill ? 'slot refill' : 'slot'}>
      <span className="slot-num">{number}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={slot.value}
        onChange={(event) => onChangeValue(event.target.value)}
        aria-label={
          isRefill ? `Slot ${number} refill` : `Slot ${number} delivered`
        }
      />
      <button
        type="button"
        className={isRefill ? 'slot-refill on' : 'slot-refill'}
        aria-pressed={isRefill}
        onClick={onToggleRefill}
      >
        Refill
      </button>
    </div>
  )
}

export default App
