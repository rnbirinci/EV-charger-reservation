import { useState, useEffect } from 'react'
import { Sun, MoonStars, SignOut, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { DayChips } from '../components/DayChips'
import { api, ApiError } from '../api/client'
import { istanbulDateStr, fmtTime, isPast, durationLabel, isDaytimeSlot } from '../lib/time'
import { useAuth } from '../auth/AuthContext'

const NIGHT_SLOTS = 13 // 22:30 -> 05:00

export function Calendar() {
  const { logout } = useAuth()
  const [day, setDay] = useState(0)
  const [mode, setMode] = useState('day')
  const [slots, setSlots] = useState([])
  const [selStart, setSelStart] = useState(null)
  const [selLen, setSelLen] = useState(0)
  const [nightSel, setNightSel] = useState(false)
  const [msg, setMsg] = useState(null) // { kind: 'ok'|'err', text }
  const [busyNow, setBusyNow] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Load the selected day's slots. The `ignore` guard drops a stale response
  // if the user switches days (or a reload fires) before it arrives, so an
  // older request can't overwrite a newer day's data.
  useEffect(() => {
    let ignore = false
    api
      .getSlots(istanbulDateStr(day))
      .then((data) => {
        if (ignore) return
        setSlots(data)
        if (day === 0) setBusyNow(computeBusyNow(data))
      })
      .catch(() => {
        if (!ignore) setMsg({ kind: 'err', text: 'Slotlar yüklenemedi.' })
      })
    return () => {
      ignore = true
    }
  }, [day, reloadKey])

  // The availability pill reflects "now", so it always tracks today regardless
  // of which day is being viewed. Fetched once on mount.
  useEffect(() => {
    api.getSlots(istanbulDateStr(0)).then((d) => setBusyNow(computeBusyNow(d))).catch(() => {})
  }, [])

  const clearSelection = () => {
    setSelStart(null)
    setSelLen(0)
    setNightSel(false)
  }

  const changeDay = (d) => {
    setDay(d)
    clearSelection()
    setMsg(null)
  }

  // Day-mode list excludes the 22:30–05:00 overnight window — those slots can
  // only be booked as the single night block. Selection indices below are into
  // daySlots. Because the daytime window has no interior gaps, consecutive
  // daySlots indices are always contiguous 30-minute slots.
  const daySlots = slots.filter((s) => isDaytimeSlot(s.time))

  // Tap logic: start, extend into the next contiguous free slot (up to 4),
  // shrink from the end, or clear — mirroring the design's list interaction.
  const tapSlot = (i) => {
    const s = daySlots[i]
    if (s.is_busy || isPast(s.time)) return
    setMsg(null)
    setNightSel(false)
    if (selStart === null) {
      setSelStart(i)
      setSelLen(1)
    } else if (i === selStart + selLen && selLen < 4 && !daySlots[i].is_busy) {
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

  const nightSlot = slots.find((s) => fmtTime(s.time) === '22:30')
  const nightBusy = !nightSlot || nightSlot.is_busy || isPast(nightSlot.time)

  const selectionSummary = nightSel
    ? '22:30 – 05:00 · gece'
    : selLen > 0
      ? `${fmtTime(daySlots[selStart].time)} – ${fmtTime(endOf(daySlots, selStart, selLen))} · ${durationLabel(selLen)}`
      : '—'

  const confirm = async () => {
    setSubmitting(true)
    setMsg(null)
    try {
      if (nightSel) {
        await api.createReservation(nightSlot.time, NIGHT_SLOTS)
      } else {
        await api.createReservation(daySlots[selStart].time, selLen)
      }
      clearSelection()
      setReloadKey((k) => k + 1) // refetch the day's slots so the new booking shows as busy
      setMsg({ kind: 'ok', text: 'Ayarlandı — cihaz senin.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Rezervasyon yapılamadı.' })
    } finally {
      setSubmitting(false)
    }
  }

  const canConfirm = (nightSel || selLen > 0) && !submitting

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header: availability pill + logout */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AvailabilityPill busyNow={busyNow} />
        <LogoutButton onClick={logout} />
      </div>

      {/* mode toggle */}
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
        <ModeButton icon={Sun} label="Gündüz" active={mode === 'day'} onClick={() => { setMode('day'); setNightSel(false); setMsg(null) }} />
        <ModeButton icon={MoonStars} label="Gece" active={mode === 'night'} onClick={() => { setMode('night'); clearSelection(); setMsg(null) }} />
      </div>

      <DayChips count={8} selected={day} onSelect={changeDay} />

      {/* slot list / night block */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mode === 'day' ? (
          <>
            {daySlots.map((s, i) => {
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
                  <span style={{ font: "500 16px var(--font-rounded)", fontVariantNumeric: 'tabular-nums', color: c.col }}>
                    {fmtTime(s.time)}
                  </span>
                  <span
                    style={{
                      font: "600 11px var(--font-text)",
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
          </>
        ) : (
          <NightBlock
            busy={nightBusy}
            selected={nightSel}
            onToggle={() => { if (!nightBusy) { setNightSel(!nightSel); setMsg(null) } }}
          />
        )}
      </div>

      {/* footer: message + selection + confirm */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--divider)', background: 'rgba(255,255,255,.02)' }}>
        {msg && <Banner msg={msg} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ font: "600 11px var(--font-text)", letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Seçimin
          </div>
          <div
            style={{
              font: "600 17px var(--font-rounded)",
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

function endOf(slots, start, len) {
  const lastStart = new Date(slots[start + len - 1].time)
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
      <span style={{ font: "600 12px var(--font-text)", color: col }}>
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
        font: "500 12px var(--font-text)",
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
        font: "600 13px var(--font-rounded)",
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon size={15} weight="fill" />
      {label}
    </button>
  )
}

function NightBlock({ busy, selected, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        padding: '32px 20px',
        borderRadius: 18,
        background: selected ? 'rgba(0,212,212,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${selected ? 'var(--ioniq-teal)' : 'var(--glass-border)'}`,
        cursor: busy ? 'not-allowed' : 'pointer',
        boxShadow: selected ? '0 0 32px rgba(0,212,212,0.20)' : 'none',
        opacity: busy ? 0.45 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <MoonStars size={36} weight="fill" color={selected ? 'var(--ioniq-teal)' : 'var(--text-secondary)'} />
      <span
        style={{
          font: "700 30px var(--font-rounded)",
          fontVariantNumeric: 'tabular-nums',
          color: selected ? 'var(--ioniq-teal)' : 'var(--text-primary)',
        }}
      >
        22:30 – 05:00
      </span>
      <span style={{ font: "600 11px var(--font-text)", letterSpacing: '1.6px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        6,5 saat · tek rezervasyon
      </span>
      <span style={{ font: "400 13px/1.5 var(--font-text)", color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 260 }}>
        Gece bloğu tek parça ayırtılır — araban sabaha hazır olur.
      </span>
      <span
        style={{
          marginTop: 6,
          padding: '8px 18px',
          borderRadius: 'var(--radius-pill)',
          background: selected ? 'var(--sel-fill)' : 'var(--glass-fill-strong)',
          border: `1px solid ${selected ? 'var(--ioniq-teal)' : 'var(--glass-border)'}`,
          font: "600 12px var(--font-text)",
          color: selected ? 'var(--ioniq-teal)' : 'var(--text-secondary)',
        }}
      >
        {busy ? 'Bu gece dolu' : selected ? 'Seçili — onayla' : 'Geceyi ayırt'}
      </span>
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
      <span style={{ font: "500 13px/1.4 var(--font-text)", color: 'var(--text-primary)' }}>{msg.text}</span>
    </div>
  )
}

const FREE = { bg: 'var(--glass-fill)', bd: 'var(--glass-border)', col: 'var(--text-primary)' }
const OCC = { bg: 'transparent', bd: 'rgba(255,255,255,0.06)', col: 'rgba(235,235,245,0.28)' }
const SEL = { bg: 'var(--sel-fill)', bd: 'var(--ioniq-teal)', col: 'var(--ioniq-teal)' }
