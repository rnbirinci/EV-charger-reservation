import { CalendarBlank, ListChecks, Clock } from '@phosphor-icons/react'

// Bottom tab bar. The admin tab ("Rezervasyonlar") is only present for admins
// — the caller passes the tab list it wants shown.
export function TabBar({ tabs, active, onSelect }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '8px 14px calc(10px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--divider)',
        background: 'rgba(10,10,10,.9)',
        backdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {tabs.map((t) => {
        const Icon = TAB_ICONS[t.key]
        const col = active === t.key ? 'var(--ioniq-teal)' : 'rgba(235,235,245,0.45)'
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0 4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon size={22} weight="fill" color={col} />
            <span style={{ font: "600 10.5px var(--font-text)", color: col }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const TAB_ICONS = {
  cal: CalendarBlank,
  mine: ListChecks,
  admin: Clock,
}
