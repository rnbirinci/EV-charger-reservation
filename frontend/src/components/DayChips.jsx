import { dayLabel } from '../lib/time'

// Horizontal scrollable day selector: today + the next `count-1` days. The
// selected chip lights teal. Optionally prepends an "all days" (-1) chip for
// the admin view.
export function DayChips({ count = 8, selected, onSelect, withAll = false }) {
  const days = []
  if (withAll) days.push({ value: -1, label: 'Tümü' })
  for (let i = 0; i < count; i++) days.push({ value: i, label: dayLabel(i) })

  return (
    <div
      className="no-scrollbar"
      style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 10px' }}
    >
      {days.map((d) => {
        const sel = d.value === selected
        return (
          <button
            key={d.value}
            onClick={() => onSelect(d.value)}
            style={{
              flex: 'none',
              padding: '8px 14px',
              borderRadius: 'var(--radius-pill)',
              background: sel ? 'var(--sel-fill)' : 'var(--glass-fill)',
              border: `1px solid ${sel ? 'var(--ioniq-teal)' : 'var(--glass-border)'}`,
              color: sel ? 'var(--ioniq-teal)' : 'var(--text-secondary)',
              font: "600 13px var(--font-rounded)",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}
