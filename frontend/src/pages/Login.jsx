import { useState } from 'react'
import { WarningCircle, Backspace, ArrowLeft } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../api/client'
import { normalizePlate, formatPlate, plateInputMode } from '../lib/plate'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

// Login is a small state machine:
//   plate -> (active)   pin           -> logged in
//         -> (needs_pin) setpin -> setpinConfirm -> logged in
const PHASE = {
  plate: {
    title: 'Hoş geldin',
    subtitle: 'Şarj cihazını ayırtmak için plakanla başla.',
  },
  pin: {
    title: 'PIN’ini gir',
    subtitle: 'Hesabına giriş yapmak için 4 haneli PIN’ini gir.',
  },
  setpin: {
    title: 'Yeni PIN belirle',
    subtitle: 'İlk girişin — kendine 4 haneli bir PIN seç.',
  },
  setpinConfirm: {
    title: 'PIN’i doğrula',
    subtitle: 'Aynı PIN’i bir kez daha gir.',
  },
}

export function Login() {
  const { login, setPin } = useAuth()
  const [phase, setPhase] = useState('plate')
  const [plate, setPlate] = useState('')
  const [pin, setPinInput] = useState('')
  const [firstPin, setFirstPin] = useState('') // the new PIN awaiting confirmation
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  // `plate` holds the raw, no-space, uppercase value; the input shows it
  // grouped ("34 ABC 123").
  const normPlate = plate

  const goBackToPlate = () => {
    setPhase('plate')
    setPinInput('')
    setFirstPin('')
    setErr(null)
  }

  // --- plate step ---
  const submitPlate = async () => {
    if (normPlate.length === 0 || busy) return
    setBusy(true)
    setErr(null)
    try {
      const { status } = await api.authStatus(normPlate)
      if (status === 'active') setPhase('pin')
      else if (status === 'needs_pin') setPhase('setpin')
      else setErr('Bu plaka kayıtlı değil. Yönetimle iletişime geç.')
    } catch {
      setErr('Bağlantı hatası, tekrar dene.')
    } finally {
      setBusy(false)
    }
  }

  // --- pin entry (keypad) ---
  const pressKey = (k) => {
    setErr(null)
    if (k === 'del') setPinInput((p) => p.slice(0, -1))
    else if (k !== '' && pin.length < 4) setPinInput((p) => p + k)
  }

  const submitPin = async () => {
    if (pin.length !== 4 || busy) return
    setBusy(true)
    setErr(null)
    try {
      await login(normPlate, pin)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Bir şeyler ters gitti.')
      setPinInput('')
    } finally {
      setBusy(false)
    }
  }

  const submitNewPin = () => {
    if (pin.length !== 4) return
    setFirstPin(pin)
    setPinInput('')
    setErr(null)
    setPhase('setpinConfirm')
  }

  const submitConfirmPin = async () => {
    if (pin.length !== 4 || busy) return
    if (pin !== firstPin) {
      setErr('PIN’ler eşleşmedi, baştan dene.')
      setPinInput('')
      setFirstPin('')
      setPhase('setpin')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await setPin(normPlate, pin)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'PIN belirlenemedi.')
      setPinInput('')
      setFirstPin('')
      setPhase('setpin')
    } finally {
      setBusy(false)
    }
  }

  const info = PHASE[phase]
  const onKeypad = phase !== 'plate'

  return (
    <div style={container}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={eyebrow}>Suhube Evleri · 22 kW</div>
        <div style={{ font: '700 32px var(--font-rounded)', letterSpacing: '-.3px' }}>{info.title}</div>
        <div style={subtitleStyle}>{info.subtitle}</div>
        {onKeypad && (
          <button onClick={goBackToPlate} style={backChip}>
            <ArrowLeft size={13} weight="bold" />
            {normPlate}
          </button>
        )}
      </div>

      {phase === 'plate' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 30 }}>
          <div style={label}>Plaka</div>
          <input
            value={formatPlate(plate)}
            onChange={(e) => {
              setPlate(normalizePlate(e.target.value))
              setErr(null)
            }}
            placeholder="örn. 34 ABC 001"
            inputMode={plateInputMode(plate)}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submitPlate()}
            style={plateInput}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 30 }}>
          <div style={label}>PIN</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {[0, 1, 2, 3].map((i) => {
              const on = i < pin.length
              return (
                <div
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 9999,
                    background: on ? 'var(--ioniq-teal)' : 'transparent',
                    border: `1.5px solid ${on ? 'var(--ioniq-teal)' : 'rgba(255,255,255,0.25)'}`,
                    boxShadow: on ? '0 0 10px rgba(0,212,212,0.5)' : 'none',
                    transition: 'all .2s',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {err && (
        <div style={errorRow}>
          <WarningCircle size={15} weight="fill" />
          {err}
        </div>
      )}

      {onKeypad && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 22 }}>
          {KEYS.map((k, idx) => (
            <button
              key={idx}
              onClick={() => pressKey(k)}
              disabled={k === ''}
              style={{
                height: 54,
                borderRadius: 14,
                background: k === '' ? 'transparent' : 'var(--glass-fill)',
                border: `1px solid ${k === '' ? 'transparent' : 'var(--glass-border)'}`,
                color: 'var(--text-primary)',
                font: '500 24px var(--font-rounded)',
                cursor: k === '' ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {k === 'del' ? <Backspace size={22} weight="fill" /> : k}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 22 }}>
        {phase === 'plate' && (
          <Button disabled={normPlate.length === 0 || busy} onClick={submitPlate}>
            {busy ? 'Kontrol ediliyor…' : 'Devam'}
          </Button>
        )}
        {phase === 'pin' && (
          <Button disabled={pin.length !== 4 || busy} onClick={submitPin}>
            {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </Button>
        )}
        {phase === 'setpin' && (
          <Button disabled={pin.length !== 4} onClick={submitNewPin}>
            Devam
          </Button>
        )}
        {phase === 'setpinConfirm' && (
          <Button disabled={pin.length !== 4 || busy} onClick={submitConfirmPin}>
            {busy ? 'Belirleniyor…' : 'Belirle ve gir'}
          </Button>
        )}
      </div>
    </div>
  )
}

const container = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '56px 24px 28px',
  overflowY: 'auto',
}

const eyebrow = {
  font: '600 11px var(--font-text)',
  letterSpacing: '1.8px',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
}

const subtitleStyle = {
  font: '400 14px/1.5 var(--font-text)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
  maxWidth: 280,
  marginTop: -6,
}

const label = {
  font: '600 11px var(--font-text)',
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
}

const plateInput = {
  width: '100%',
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  borderRadius: 12,
  padding: '14px 16px',
  font: '500 17px var(--font-rounded)',
  color: 'var(--text-primary)',
  outline: 'none',
  textAlign: 'center',
  letterSpacing: 1,
  textTransform: 'uppercase',
}

const backChip = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--glass-fill)',
  border: '1px solid var(--glass-border)',
  color: 'var(--text-secondary)',
  font: '600 12px var(--font-rounded)',
  letterSpacing: 1,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

const errorRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 16,
  font: '500 13px var(--font-text)',
  color: 'var(--critical)',
}
