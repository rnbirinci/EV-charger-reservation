import { useState } from 'react'
import { WarningCircle, Backspace } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export function Login() {
  const { login } = useAuth()
  const [plate, setPlate] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const pressKey = (k) => {
    setErr(null)
    if (k === 'del') setPin((p) => p.slice(0, -1))
    else if (k !== '' && pin.length < 4) setPin((p) => p + k)
  }

  const canSubmit = plate.trim().length > 0 && pin.length === 4 && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setErr(null)
    try {
      await login(plate.trim().toUpperCase(), pin)
      // On success the app shell swaps to the authed view automatically.
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Bir şeyler ters gitti.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '56px 24px 28px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={eyebrow}>Suhube Evleri · 22 kW</div>
        <div style={{ font: "700 32px var(--font-rounded)", letterSpacing: '-.3px' }}>Hoş geldin</div>
        <div
          style={{
            font: "400 14px/1.5 var(--font-text)",
            color: 'var(--text-secondary)',
            textAlign: 'center',
            maxWidth: 280,
            marginTop: -6,
          }}
        >
          Şarj cihazını ayırtmak için plakan ve PIN'inle gir.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 30 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={label}>Plaka</div>
          <input
            value={plate}
            onChange={(e) => {
              setPlate(e.target.value)
              setErr(null)
            }}
            placeholder="örn. 34ABC001"
            autoCapitalize="characters"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{
              width: '100%',
              background: 'var(--glass-fill)',
              border: '1px solid var(--glass-border)',
              borderRadius: 12,
              padding: '14px 16px',
              font: "500 17px var(--font-rounded)",
              color: 'var(--text-primary)',
              outline: 'none',
              textAlign: 'center',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 2 }}>
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

        {err && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              font: "500 13px var(--font-text)",
              color: 'var(--critical)',
            }}
          >
            <WarningCircle size={15} weight="fill" />
            {err}
          </div>
        )}
      </div>

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
              font: "500 24px var(--font-rounded)",
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

      <div style={{ marginTop: 'auto', paddingTop: 22 }}>
        <Button disabled={!canSubmit} onClick={submit}>
          {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Button>
        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            font: "400 12px var(--font-text)",
            color: 'var(--text-tertiary)',
          }}
        >
          Demo — sakin: 34ABC001 · 1234 &nbsp;·&nbsp; yönetici: 34ABC000 · 0123
        </div>
      </div>
    </div>
  )
}

const eyebrow = {
  font: "600 11px var(--font-text)",
  letterSpacing: '1.8px',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
}

const label = {
  font: "600 11px var(--font-text)",
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
}
