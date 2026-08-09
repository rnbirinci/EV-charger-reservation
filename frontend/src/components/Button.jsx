// Primary solid button from the BCar design system: teal fill, dark ink,
// full-width by default, soft teal glow. Fades and de-glows when disabled.
export function Button({ children, disabled, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 56,
        border: 'none',
        borderRadius: 14,
        background: disabled ? 'rgba(255,255,255,0.08)' : 'var(--ioniq-teal)',
        color: disabled ? 'var(--text-tertiary)' : '#001a1a',
        font: "600 16px var(--font-rounded)",
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : '0 0 20px rgba(0,212,212,0.35)',
        transition: 'all .2s',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  )
}
