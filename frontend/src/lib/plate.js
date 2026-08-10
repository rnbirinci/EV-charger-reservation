// Turkish plate helpers. A plate is 2 province digits + 1-3 letters + 2-4
// digits, e.g. "34 ABC 123". We store the raw (no-space, uppercase) form and
// only add spaces for display.

// Strip everything that isn't a letter or digit, uppercase, and clamp to the
// plate's max shape (2 digits + 3 letters + 4 digits).
export function normalizePlate(s) {
  const cleaned = (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = cleaned.match(/^(\d{0,2})([A-Z]{0,3})(\d{0,4})/)
  if (!m) return cleaned.slice(0, 9)
  return (m[1] + m[2] + m[3]).slice(0, 9)
}

// Group the raw plate into "NN LLL DDDD" for display.
export function formatPlate(raw) {
  const m = (raw || '').match(/^(\d{0,2})([A-Z]{0,3})(\d{0,4})$/)
  if (!m) return raw
  return [m[1], m[2], m[3]].filter(Boolean).join(' ')
}

// Which mobile keyboard to show next: numeric for the province and trailing
// digits, text (letters) for the middle. On Android this switches live; iOS
// may keep the current keyboard until the field is re-focused.
export function plateInputMode(raw) {
  const m = (raw || '').match(/^(\d{0,2})([A-Z]{0,3})(\d{0,4})$/)
  if (!m) return 'text'
  const [, prov, letters, digits] = m
  if (prov.length < 2) return 'numeric' // typing the province
  if (digits.length > 0) return 'numeric' // typing the trailing digits
  if (letters.length >= 3) return 'numeric' // letters maxed → digits next
  return 'text' // typing letters
}
