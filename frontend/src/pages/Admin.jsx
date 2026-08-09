import { useState, useEffect, useCallback } from 'react'
import { SignOut, CalendarCheck, MoonStars } from '@phosphor-icons/react'
import { DayChips } from '../components/DayChips'
import { api } from '../api/client'
import { fmtRange, fmtDate, istanbulDateStr, istanbulDateOfISO, isReservationPast } from '../lib/time'
import { useAuth } from '../auth/AuthContext'

const NIGHT_SLOTS = 13

export function Admin() {
  const { logout } = useAuth()
  const [reservations, setReservations] = useState([])
  const [day, setDay] = useState(-1) // -1 = all days
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = (await api.getAllReservations()) ?? []
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

  const q = query.trim().toUpperCase().replace(/\s+/g, '')
  const filtered = reservations
    .filter((r) => !isReservationPast(r.slots))
    .filter((r) => day === -1 || istanbulDateOfISO(r.slots[0]) === istanbulDateStr(day))
    .filter((r) => q === '' || r.license_plate.toUpperCase().includes(q))
    .sort((a, b) => new Date(a.slots[0]) - new Date(b.slots[0]))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ font: "700 24px var(--font-rounded)" }}>Rezervasyonlar</div>
        <button onClick={logout} style={logoutStyle}>
          <SignOut size={15} weight="fill" />
          Çıkış
        </button>
      </div>
      <div style={{ padding: '0 20px 4px', font: "400 13px var(--font-text)", color: 'var(--text-secondary)' }}>
        {loading ? 'Yükleniyor…' : `${filtered.length} aktif rezervasyon`}
      </div>

      <DayChips count={8} selected={day} onSelect={setDay} withAll />

      <div style={{ padding: '8px 20px 4px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Plaka ara — örn. 34ABC"
          style={{
            width: '100%',
            background: 'var(--glass-fill)',
            border: '1px solid var(--glass-border)',
            borderRadius: 12,
            padding: '11px 14px',
            font: "500 14px var(--font-text)",
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <div style={{ font: "500 13px var(--font-text)", color: 'var(--critical)' }}>{error}</div>}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: "400 14px var(--font-text)", color: 'var(--text-secondary)' }}>
            Bu filtreyle rezervasyon yok.
          </div>
        )}

        {filtered.map((r) => {
          const night = r.slots.length === NIGHT_SLOTS
          const Icon = night ? MoonStars : CalendarCheck
          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--glass-fill)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <Icon size={18} weight="fill" color="var(--text-secondary)" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ font: "600 15px var(--font-rounded)", fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                  {night ? '22:30 – 05:00' : fmtRange(r.slots)}
                </div>
                <div style={{ font: "400 12px var(--font-text)", color: 'var(--text-secondary)' }}>
                  {r.license_plate} · {r.user_name} · {fmtDate(r.slots[0])}
                </div>
              </div>
              <button
                onClick={() => cancel(r.id)}
                style={{
                  padding: '8px 13px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid rgba(255,59,48,.4)',
                  color: 'var(--critical)',
                  font: "600 12.5px var(--font-text)",
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                İptal
              </button>
            </div>
          )
        })}
      </div>
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
