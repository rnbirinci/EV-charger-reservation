import { useState, useEffect, useCallback } from 'react'
import { SignOut, CalendarPlus, CalendarCheck, Lightning, MoonStars } from '@phosphor-icons/react'
import { api } from '../api/client'
import { fmtRange, fmtDate, durationLabel, isLiveNow, isReservationPast } from '../lib/time'
import { useAuth } from '../auth/AuthContext'

const NIGHT_SLOTS = 13

export function MyReservations() {
  const { logout } = useAuth()
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = (await api.getMyReservations()) ?? []
      // Sort by start time (guard against a null body from an empty result).
      data.sort((a, b) => new Date(a.slots[0]) - new Date(b.slots[0]))
      setReservations(data)
    } catch {
      setError('Rezervasyonlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cancel = async (id) => {
    try {
      await api.cancelReservation(id)
      setReservations((rs) => rs.filter((r) => r.id !== id))
    } catch {
      setError('İptal edilemedi.')
    }
  }

  const active = reservations.filter((r) => !isReservationPast(r.slots))
  const past = reservations.filter((r) => isReservationPast(r.slots))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ font: "700 24px var(--font-rounded)" }}>Rezervasyonlarım</div>
        <button onClick={logout} style={logoutStyle}>
          <SignOut size={15} weight="fill" />
          Çıkış
        </button>
      </div>
      <div style={{ padding: '0 20px 8px', font: "400 13px var(--font-text)", color: 'var(--text-secondary)' }}>
        {loading ? 'Yükleniyor…' : `${active.length} aktif rezervasyon · en fazla 2`}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <div style={{ font: "500 13px var(--font-text)", color: 'var(--critical)' }}>{error}</div>}

        {!loading && active.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '56px 20px', textAlign: 'center' }}>
            <CalendarPlus size={34} weight="fill" color="var(--text-tertiary)" />
            <div style={{ font: "400 14px/1.5 var(--font-text)", color: 'var(--text-secondary)', maxWidth: 240 }}>
              Henüz rezervasyonun yok — Takvim'den bir slot ayırtabilirsin.
            </div>
          </div>
        )}

        {active.map((r) => (
          <ReservationCard key={r.id} r={r} onCancel={() => cancel(r.id)} />
        ))}

        {past.length > 0 && (
          <>
            <div style={{ font: "600 11px var(--font-text)", letterSpacing: '1.4px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 12 }}>
              Geçmiş
            </div>
            {past.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.06)',
                  opacity: 0.55,
                }}
              >
                <CalendarCheck size={18} weight="fill" color="var(--text-tertiary)" />
                <div style={{ flex: 1, font: "500 15px var(--font-rounded)", fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                  {fmtRange(r.slots)}
                </div>
                <div style={{ font: "400 12px var(--font-text)", color: 'var(--text-tertiary)' }}>{fmtDate(r.slots[0])}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function ReservationCard({ r, onCancel }) {
  const live = isLiveNow(r.slots)
  const night = r.slots.length === NIGHT_SLOTS
  const Icon = night ? MoonStars : live ? Lightning : CalendarCheck
  const iconCol = live ? 'var(--ioniq-electric)' : 'var(--ioniq-teal)'
  const subParts = [fmtDate(r.slots[0]), night ? 'gece bloğu' : durationLabel(r.slots.length)]
  if (live) subParts.push('şu an aktif')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 18,
        background: live ? 'rgba(0,240,255,0.06)' : 'var(--glass-fill)',
        border: `1px solid ${live ? 'rgba(0,240,255,0.45)' : 'var(--glass-border)'}`,
        boxShadow: live ? '0 0 24px rgba(0,240,255,0.15)' : 'none',
      }}
    >
      <Icon size={22} weight="fill" color={iconCol} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ font: "600 17px var(--font-rounded)", fontVariantNumeric: 'tabular-nums', color: live ? 'var(--ioniq-electric)' : 'var(--text-primary)' }}>
          {night ? '22:30 – 05:00' : fmtRange(r.slots)}
        </div>
        <div style={{ font: "400 12px var(--font-text)", color: 'var(--text-secondary)' }}>{subParts.join(' · ')}</div>
      </div>
      {!live && (
        <button
          onClick={onCancel}
          style={{
            padding: '9px 14px',
            borderRadius: 10,
            background: 'transparent',
            border: '1px solid rgba(255,59,48,.4)',
            color: 'var(--critical)',
            font: "600 13px var(--font-text)",
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          İptal
        </button>
      )}
    </div>
  )
}

const logoutStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  color: 'var(--text-tertiary)',
  font: "500 12px var(--font-text)",
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}
