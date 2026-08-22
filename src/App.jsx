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
    return Object.fromEntries(
      DAYS.map((day) => {
        const entry = saved[day] ?? emptyDay()
        const slots = Array.from({ length: SLOT_COUNT }, (_, index) =>
          normalizeSlot(entry.slots?.[index]),
        )
        return [day, { start: String(entry.start ?? ''), slots }]
      }),
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
  const hasStart = week.Monday.start.trim() !== ''
  let running = hasStart ? parseLitres(week.Monday.start) : null

  return Object.fromEntries(
    DAYS.map((name) => {
      const start = running
      const { used, refilled } = slotTotals(week[name].slots)
      const remaining = start === null ? null : start - used + refilled
      running = remaining
      return [name, { start, used, refilled, remaining }]
    }),
  )
}

function App() {
  const [week, setWeek] = useState(loadWeek)
  const [day, setDay] = useState('Monday')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [openSlot, setOpenSlot] = useState(null)
  const sheet = week[day]
  const dayIndex = DAYS.indexOf(day)
  const previousDay = dayIndex > 0 ? DAYS[dayIndex - 1] : null
  const isMonday = day === 'Monday'

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(week))
  }, [week])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      setConfirmingClear(false)
      setOpenSlot(null)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (openSlot === null) return undefined

    function onPointerDown(event) {
      if (event.target.closest(`[data-slot="${openSlot + 1}"]`)) return
      setOpenSlot(null)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [openSlot])

  const balances = useMemo(() => weekBalances(week), [week])
  const { start, used, refilled, remaining } = balances[day]
  const hasStart = start !== null

  function updateDay(name, patch) {
    setWeek((current) => ({
      ...current,
      [name]: { ...current[name], ...patch },
    }))
  }

  function setWeekStart(value) {
    updateDay('Monday', { start: value })
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
    setOpenSlot(null)
  }

  return (
    <div className="app">
      <main className="shell">
        <header className="masthead">
          <img className="logo" src="/elgas.png" alt="Elgas" />
          <p className="date">{day}</p>
        </header>

        <label className={isMonday ? 'balance' : 'balance carried'}>
          <span>Starting balance</span>
          {isMonday ? (
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={week.Monday.start}
              onChange={(event) => setWeekStart(event.target.value)}
              placeholder="Litres in tank"
              aria-label="Monday starting balance"
            />
          ) : (
            <input
              value={hasStart ? formatLitres(start) : ''}
              placeholder={
                previousDay ? `Carried from ${previousDay}` : 'Litres in tank'
              }
              aria-label={`${day} starting balance, carried from ${previousDay}`}
              readOnly
              tabIndex={-1}
            />
          )}
          {!isMonday ? (
            <small>
              {hasStart
                ? `Carried from ${previousDay}`
                : `Enter Monday’s starting balance first`}
            </small>
          ) : null}
        </label>

        <nav className="days" aria-label="Days of the week">
          {DAYS.map((name) => (
            <button
              key={name}
              type="button"
              className={name === day ? 'day active' : 'day'}
              onClick={() => {
                setDay(name)
                setConfirmingClear(false)
                setOpenSlot(null)
              }}
              aria-current={name === day ? 'page' : undefined}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </nav>

        <section className="summary" aria-live="polite">
          <p>
            <span>Used</span>
            <strong>{formatLitres(used)} L</strong>
          </p>
          <p>
            <span>Refilled</span>
            <strong>{formatLitres(refilled)} L</strong>
          </p>
          <p>
            <span>In tank</span>
            <strong className={hasStart && remaining < 0 ? 'low' : undefined}>
              {hasStart ? `${formatLitres(remaining)} L` : '—'}
            </strong>
          </p>
        </section>

        <section className="sheet" aria-label={`${day} fuel slots`}>
          <p className="sheet-label">
            {day} · 35 slots · tap a number to mark refill
          </p>
          <div className="grid">
            {sheet.slots.map((slot, index) => (
              <Slot
                key={index}
                number={index + 1}
                slot={slot}
                menuOpen={openSlot === index}
                onToggleMenu={() =>
                  setOpenSlot((current) => (current === index ? null : index))
                }
                onChangeValue={(value) => updateSlot(index, { value })}
                onChangeKind={(kind) => {
                  updateSlot(index, { kind })
                  setOpenSlot(null)
                }}
              />
            ))}
          </div>
        </section>

        <button
          type="button"
          className="clear"
          onClick={() => {
            setConfirmingClear(true)
            setOpenSlot(null)
          }}
        >
          Clear {day}
        </button>

        <figure className="hero">
          <img src="/elgas-truck.png" alt="Elgas tanker" />
        </figure>
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

function Slot({
  number,
  slot,
  menuOpen,
  onToggleMenu,
  onChangeValue,
  onChangeKind,
}) {
  const isRefill = slot.kind === 'refill'

  return (
    <div
      className={isRefill ? 'slot refill' : 'slot'}
      data-slot={number}
    >
      <button
        type="button"
        className="slot-num"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`Slot ${number} type, ${isRefill ? 'refill' : 'used'}`}
        onClick={onToggleMenu}
      >
        {number}
      </button>
      {menuOpen ? (
        <div className="slot-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className={isRefill ? undefined : 'selected'}
            onClick={() => onChangeKind('use')}
          >
            Used
          </button>
          <button
            type="button"
            role="menuitem"
            className={isRefill ? 'selected' : undefined}
            onClick={() => onChangeKind('refill')}
          >
            Refill
          </button>
        </div>
      ) : null}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={slot.value}
        onChange={(event) => onChangeValue(event.target.value)}
        aria-label={
          isRefill ? `Slot ${number} refill` : `Slot ${number} used`
        }
      />
    </div>
  )
}

export default App
