import { useState, useEffect } from 'react'
import { Sun, MoonStars, SignOut, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { DayChips } from '../components/DayChips'
import { api, ApiError } from '../api/client'
import {
  istanbulDateStr,
  fmtTime,
  isPast,
  durationLabel,
  isDaytimeSlot,
  isNightEveningSlot,
  isNightMorningSlot,
} from '../lib/time'
import { useAuth } from '../auth/AuthContext'

export function Calendar() {
  const { logout } = useAuth()
  const [day, setDay] = useState(0)
  const [mode, setMode] = useState('day')
  const [slots, setSlots] = useState([]) // selected day (D)
  const [nextSlots, setNextSlots] = useState([]) // next day (D+1), for night mornings
  const [selStart, setSelStart] = useState(null)
  const [selLen, setSelLen] = useState(0)
  const [msg, setMsg] = useState(null) // { kind: 'ok'|'err', text }
  const [busyNow, setBusyNow] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Load D and D+1 together: the night window (22:30–06:00) spans both — D's
  // evening plus the next morning. The ignore guard drops a stale response if
  // the day/reload changes before it arrives.
  useEffect(() => {
    let ignore = false
    Promise.all([api.getSlots(istanbulDateStr(day)), api.getSlots(istanbulDateStr(day + 1))])
      .then(([d, next]) => {
        if (ignore) return
        setSlots(d)
        setNextSlots(next)
        if (day === 0) setBusyNow(computeBusyNow(d))
      })
      .catch(() => {
        if (!ignore) setMsg({ kind: 'err', text: 'Slotlar yüklenemedi.' })
      })
    return () => {
      ignore = true
    }
  }, [day, reloadKey])

  // Availability pill reflects "now", so it always tracks today.
  useEffect(() => {
    api.getSlots(istanbulDateStr(0)).then((d) => setBusyNow(computeBusyNow(d))).catch(() => {})
  }, [])

  const clearSelection = () => {
    setSelStart(null)
    setSelLen(0)
  }

  const changeDay = (d) => {
    setDay(d)
    clearSelection()
    setMsg(null)
  }

  const changeMode = (m) => {
    setMode(m)
    clearSelection()
    setMsg(null)
  }

  // Daytime: 06:30–22:00 slots, max 4. Night: 22:30–06:00 = this evening's
  // late slots + the next morning's early slots, no length cap.
  const daySlots = slots.filter((s) => isDaytimeSlot(s.time))
  const nightSlots = [
    ...slots.filter((s) => isNightEveningSlot(s.time)),
    ...nextSlots.filter((s) => isNightMorningSlot(s.time)),
  ]
  const activeSlots = mode === 'day' ? daySlots : nightSlots
  const maxLen = mode === 'day' ? 4 : nightSlots.length

  // Tap to start, extend into the next contiguous free slot (up to maxLen),
  // shrink from the end, or clear. daySlots/nightSlots have no interior gaps,
  // so consecutive indices are contiguous 30-minute slots.
  const tapSlot = (i) => {
    const s = activeSlots[i]
    if (s.is_busy || isPast(s.time)) return
    setMsg(null)
    if (selStart === null) {
      setSelStart(i)
      setSelLen(1)
    } else if (i === selStart + selLen && selLen < maxLen && !activeSlots[i].is_busy) {
      setSelLen(selLen + 1)
    } else if (i === selStart + selLen - 1 && selLen > 1) {
      setSelLen(selLen - 1)
    } else if (i >= selStart && i < selStart + selLen) {
      clearSelection()
    } else {
      setSelStart(i)
      setSelLen(1)
    }
  }

  const selectionSummary =
    selLen > 0
      ? `${fmtTime(activeSlots[selStart].time)} – ${fmtTime(endOf(activeSlots, selStart, selLen))} · ${durationLabel(selLen)}`
      : '—'

  const confirm = async () => {
    setSubmitting(true)
    setMsg(null)
    try {
      await api.createReservation(activeSlots[selStart].time, selLen)
      clearSelection()
      setReloadKey((k) => k + 1)
      setMsg({ kind: 'ok', text: 'Ayarlandı — cihaz senin.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Rezervasyon yapılamadı.' })
    } finally {
      setSubmitting(false)
    }
  }

  const canConfirm = selLen > 0 && !submitting

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AvailabilityPill busyNow={busyNow} />
        <LogoutButton onClick={logout} />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          margin: '16px 20px 0',
          padding: 4,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--glass-fill)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <ModeButton icon={Sun} label="Gündüz" active={mode === 'day'} onClick={() => changeMode('day')} />
        <ModeButton icon={MoonStars} label="Gece" active={mode === 'night'} onClick={() => changeMode('night')} />
      </div>

      <DayChips count={8} selected={day} onSelect={changeDay} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mode === 'night' && (
          <div style={{ font: '400 12px/1.4 var(--font-text)', color: 'var(--text-tertiary)', padding: '4px 2px' }}>
            Gece 22:30 – 06:00. İstediğin kadar ardışık slot seçebilirsin.
          </div>
        )}
        {activeSlots.map((s, i) => {
          const gone = isPast(s.time)
          const sel = selStart !== null && i >= selStart && i < selStart + selLen
          const c = sel ? SEL : s.is_busy || gone ? OCC : FREE
          return (
            <button
              key={s.time}
              onClick={() => tapSlot(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 12,
                background: c.bg,
                border: `1px solid ${c.bd}`,
                cursor: s.is_busy || gone ? 'default' : 'pointer',
                minHeight: 46,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ font: '500 16px var(--font-rounded)', fontVariantNumeric: 'tabular-nums', color: c.col }}>
                {fmtTime(s.time)}
              </span>
              <span
                style={{
                  font: '600 11px var(--font-text)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: sel ? 'var(--ioniq-teal)' : 'rgba(235,235,245,0.28)',
                }}
              >
                {gone ? 'Geçti' : s.is_busy ? 'Dolu' : sel ? 'Seçili' : ''}
              </span>
            </button>
          )
        })}
        <div style={{ height: 10 }} />
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--divider)', background: 'rgba(255,255,255,.02)' }}>
        {msg && <Banner msg={msg} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ font: '600 11px var(--font-text)', letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Seçimin
          </div>
          <div
            style={{
              font: '600 17px var(--font-rounded)',
              fontVariantNumeric: 'tabular-nums',
              color: selectionSummary === '—' ? 'var(--text-tertiary)' : 'var(--ioniq-teal)',
            }}
          >
            {selectionSummary}
          </div>
        </div>
        <Button disabled={!canConfirm} onClick={confirm}>
          {submitting ? 'Onaylanıyor…' : 'Rezervasyonu onayla'}
        </Button>
      </div>
    </div>
  )
}

function computeBusyNow(slots) {
  const now = Date.now()
  return slots.some((s) => {
    const start = new Date(s.time).getTime()
    return s.is_busy && start <= now && now < start + 30 * 60 * 1000
  })
}

function endOf(list, start, len) {
  const lastStart = new Date(list[start + len - 1].time)
  return new Date(lastStart.getTime() + 30 * 60 * 1000).toISOString()
}

function AvailabilityPill({ busyNow }) {
  const busy = busyNow === true
  const col = busy ? 'var(--warning)' : 'var(--ioniq-teal)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 12px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--glass-fill)',
        border: `1px solid ${busy ? 'rgba(255,149,0,.35)' : 'rgba(0,212,212,.35)'}`,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: 9999,
          background: col,
          boxShadow: `0 0 8px ${col}`,
          animation: 'bc-breathe 3s ease-in-out infinite',
        }}
      />
      <span style={{ font: '600 12px var(--font-text)', color: col }}>
        {busyNow === null ? '—' : busy ? 'Şu an dolu' : 'Şu an müsait'}
      </span>
    </div>
  )
}

function LogoutButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        color: 'var(--text-tertiary)',
        font: '500 12px var(--font-text)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <SignOut size={15} weight="fill" />
      Çıkış
    </button>
  )
}

function ModeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '9px 0',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--sel-fill)' : 'transparent',
        color: active ? 'var(--ioniq-teal)' : 'var(--text-secondary)',
        font: '600 13px var(--font-rounded)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon size={15} weight="fill" />
      {label}
    </button>
  )
}

function Banner({ msg }) {
  const ok = msg.kind === 'ok'
  const Icon = ok ? CheckCircle : WarningCircle
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: ok ? 'rgba(52,199,89,.12)' : 'rgba(255,149,0,.12)',
        border: `1px solid ${ok ? 'rgba(52,199,89,.35)' : 'rgba(255,149,0,.4)'}`,
        marginBottom: 12,
      }}
    >
      <Icon size={18} weight="fill" color={ok ? 'var(--success)' : 'var(--warning)'} />
      <span style={{ font: '500 13px/1.4 var(--font-text)', color: 'var(--text-primary)' }}>{msg.text}</span>
    </div>
  )
}

const FREE = { bg: 'var(--glass-fill)', bd: 'var(--glass-border)', col: 'var(--text-primary)' }
const OCC = { bg: 'transparent', bd: 'rgba(255,255,255,0.06)', col: 'rgba(235,235,245,0.28)' }
const SEL = { bg: 'var(--sel-fill)', bd: 'var(--ioniq-teal)', col: 'var(--ioniq-teal)' }
