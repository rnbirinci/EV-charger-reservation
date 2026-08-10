import { useState, useEffect, useCallback } from 'react'
import { SignOut, CalendarCheck, MoonStars, UserPlus, User, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { DayChips } from '../components/DayChips'
import { Button } from '../components/Button'
import { api, ApiError } from '../api/client'
import { fmtRange, fmtDate, istanbulDateStr, istanbulDateOfISO, isReservationPast, isNightReservation } from '../lib/time'
import { normalizePlate, formatPlate, plateInputMode } from '../lib/plate'
import { useAuth } from '../auth/AuthContext'

export function Admin() {
  const { logout } = useAuth()
  const [view, setView] = useState('reservations')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ font: '700 24px var(--font-rounded)' }}>Yönetici</div>
        <button onClick={logout} style={logoutStyle}>
          <SignOut size={15} weight="fill" />
          Çıkış
        </button>
      </div>

      <div style={segmentWrap}>
        <SegButton label="Rezervasyonlar" active={view === 'reservations'} onClick={() => setView('reservations')} />
        <SegButton label="Komşular" active={view === 'users'} onClick={() => setView('users')} />
      </div>

      {view === 'reservations' ? <ReservationsView /> : <UsersView />}
    </div>
  )
}

function ReservationsView() {
  const [reservations, setReservations] = useState([])
  const [day, setDay] = useState(-1)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setReservations((await api.getAllReservations()) ?? [])
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
    <>
      <div style={{ padding: '4px 20px', font: '400 13px var(--font-text)', color: 'var(--text-secondary)' }}>
        {loading ? 'Yükleniyor…' : `${filtered.length} aktif rezervasyon`}
      </div>
      <DayChips count={8} selected={day} onSelect={setDay} withAll />
      <div style={{ padding: '8px 20px 4px' }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Plaka ara — örn. 34ABC" style={inputStyle} />
      </div>
      <div style={scrollArea}>
        {error && <div style={errText}>{error}</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '400 14px var(--font-text)', color: 'var(--text-secondary)' }}>
            Bu filtreyle rezervasyon yok.
          </div>
        )}
        {filtered.map((r) => {
          const Icon = isNightReservation(r.slots) ? MoonStars : CalendarCheck
          return (
            <div key={r.id} style={rowCard}>
              <Icon size={18} weight="fill" color="var(--text-secondary)" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ font: '600 15px var(--font-rounded)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                  {fmtRange(r.slots)}
                </div>
                <div style={{ font: '400 12px var(--font-text)', color: 'var(--text-secondary)' }}>
                  {r.license_plate} · {r.user_name} · {fmtDate(r.slots[0])}
                </div>
              </div>
              <button onClick={() => cancel(r.id)} style={dangerBtn}>İptal</button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function UsersView() {
  const { user, isSuper } = useAuth()
  const myId = Number(user?.sub)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [plate, setPlate] = useState('')
  const [msg, setMsg] = useState(null) // { kind, text }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setUsers((await api.getAllUsers()) ?? [])
    } catch {
      setMsg({ kind: 'err', text: 'Kullanıcılar yüklenemedi.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const canAdd = name.trim() && surname.trim() && plate.trim() && !busy

  const addUser = async () => {
    if (!canAdd) return
    setBusy(true)
    setMsg(null)
    try {
      await api.createUser({ name: name.trim(), surname: surname.trim(), licensePlate: plate })
      setName('')
      setSurname('')
      setPlate('')
      setMsg({ kind: 'ok', text: 'Komşu eklendi — ilk girişinde PIN’ini kendisi belirleyecek.' })
      load()
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof ApiError ? e.message : 'Komşu eklenemedi.' })
    } finally {
      setBusy(false)
    }
  }

  const resetPin = async (id) => {
    setMsg(null)
    try {
      await api.resetUserPin(id)
      setMsg({ kind: 'ok', text: 'PIN sıfırlandı — kullanıcı yeni PIN’ini belirleyecek.' })
      load()
    } catch {
      setMsg({ kind: 'err', text: 'PIN sıfırlanamadı.' })
    }
  }

  const changeRole = async (id, role) => {
    setMsg(null)
    try {
      await api.setUserRole(id, role)
      setMsg({ kind: 'ok', text: role === 'admin' ? 'Yönetici yapıldı.' : 'Sakinliğe alındı.' })
      load()
    } catch {
      setMsg({ kind: 'err', text: 'Rol değiştirilemedi.' })
    }
  }

  return (
    <div style={scrollArea}>
      {/* add-user form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad" style={inputStyle} />
          <input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Soyad" style={inputStyle} />
        </div>
        <input
          value={formatPlate(plate)}
          onChange={(e) => setPlate(normalizePlate(e.target.value))}
          placeholder="Plaka — örn. 34 ABC 001"
          inputMode={plateInputMode(plate)}
          autoCapitalize="characters"
          autoComplete="off"
          style={inputStyle}
        />
        <Button disabled={!canAdd} onClick={addUser}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} weight="fill" />
            {busy ? 'Ekleniyor…' : 'Komşu ekle'}
          </span>
        </Button>
      </div>

      {msg && <Banner msg={msg} />}

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', font: '400 14px var(--font-text)' }}>Yükleniyor…</div>
      ) : (
        users.map((u) => {
          const isSelf = u.id === myId
          const isTargetSuper = u.role === 'superadmin'
          const canManage = !isSelf && !isTargetSuper
          return (
            <div key={u.id} style={rowCard}>
              <User size={18} weight="fill" color={isTargetSuper ? 'var(--ioniq-teal)' : 'var(--text-secondary)'} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ font: '600 15px var(--font-rounded)', color: 'var(--text-primary)' }}>
                  {u.name} {u.surname}
                </div>
                <div style={{ font: '400 12px var(--font-text)', color: 'var(--text-secondary)' }}>
                  {u.license_plate} · {roleLabel(u.role)}
                  {!u.pin_set && ' · PIN bekliyor'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {/* only a superadmin sees role toggles */}
                {isSuper && canManage &&
                  (u.role === 'admin' ? (
                    <button onClick={() => changeRole(u.id, 'resident')} style={neutralBtn}>Sakinliğe al</button>
                  ) : (
                    <button onClick={() => changeRole(u.id, 'admin')} style={neutralBtn}>Yönetici yap</button>
                  ))}
                {canManage &&
                  (u.pin_set ? (
                    <button onClick={() => resetPin(u.id)} style={dangerBtn}>PIN sıfırla</button>
                  ) : (
                    <span style={pendingChip}>PIN bekliyor</span>
                  ))}
                {isTargetSuper && <span style={superBadge}>süper yönetici</span>}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function SegButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
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
        marginBottom: 10,
      }}
    >
      <Icon size={18} weight="fill" color={ok ? 'var(--success)' : 'var(--warning)'} />
      <span style={{ font: '500 13px/1.4 var(--font-text)', color: 'var(--text-primary)' }}>{msg.text}</span>
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
  font: '500 12px var(--font-text)',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

const segmentWrap = {
  display: 'flex',
  gap: 6,
  margin: '10px 20px 4px',
  padding: 4,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
}

const scrollArea = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 20px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const inputStyle = {
  width: '100%',
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  borderRadius: 12,
  padding: '11px 14px',
  // 16px minimum so iOS Safari doesn't auto-zoom the page on focus.
  font: '500 16px var(--font-text)',
  color: 'var(--text-primary)',
  outline: 'none',
}

const rowCard = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 14,
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
}

const dangerBtn = {
  padding: '8px 13px',
  borderRadius: 10,
  background: 'transparent',
  border: '1px solid rgba(255,59,48,.4)',
  color: 'var(--critical)',
  font: '600 12.5px var(--font-text)',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  whiteSpace: 'nowrap',
}

const pendingChip = {
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--glass-fill-strong)',
  border: '1px solid var(--glass-border)',
  color: 'var(--text-secondary)',
  font: '600 11px var(--font-text)',
  whiteSpace: 'nowrap',
}

const neutralBtn = {
  padding: '8px 13px',
  borderRadius: 10,
  background: 'transparent',
  border: '1px solid var(--glass-highlight)',
  color: 'var(--text-primary)',
  font: '600 12.5px var(--font-text)',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  whiteSpace: 'nowrap',
}

const superBadge = {
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--sel-fill)',
  border: '1px solid rgba(0,212,212,.35)',
  color: 'var(--ioniq-teal)',
  font: '600 11px var(--font-text)',
  whiteSpace: 'nowrap',
}

function roleLabel(role) {
  if (role === 'superadmin') return 'süper yönetici'
  if (role === 'admin') return 'yönetici'
  return 'sakin'
}

const errText = { font: '500 13px var(--font-text)', color: 'var(--critical)' }
