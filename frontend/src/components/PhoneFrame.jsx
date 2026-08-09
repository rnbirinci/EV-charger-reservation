// The 430px-wide dark app column, centered on any screen. Mobile-first: on a
// phone it fills the viewport; on desktop it stays a phone-width strip with
// hairline sides, matching the design mockup.
export function PhoneFrame({ children }) {
  return (
    <div
      style={{
        maxWidth: 430,
        margin: '0 auto',
        height: '100dvh',
        background: 'var(--bg-primary)',
        borderLeft: '1px solid rgba(255,255,255,.07)',
        borderRight: '1px solid rgba(255,255,255,.07)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </div>
  )
}
