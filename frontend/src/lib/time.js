// All display and day math is pinned to Europe/Istanbul (UTC+3, no DST), so it
// matches the backend's slot generation regardless of the viewer's own
// timezone. Slot timestamps from the API carry a +03:00 offset; we render and
// compare them as absolute instants.

const TZ = 'Europe/Istanbul'
const DAY_MS = 24 * 60 * 60 * 1000

// YYYY-MM-DD for today + offsetDays, as the calendar date in Istanbul. Used as
// the ?date= param for GET /api/slots.
export function istanbulDateStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * DAY_MS)
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// YYYY-MM-DD (Istanbul) for a given ISO timestamp — used to match a
// reservation against a selected day filter.
export function istanbulDateOfISO(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function dayLabel(offsetDays) {
  const d = new Date(Date.now() + offsetDays * DAY_MS)
  // e.g. "11 Ağustos Salı"
  const full = new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(d)
  if (offsetDays === 0) return `Bugün - ${full}`
  if (offsetDays === 1) return `Yarın - ${full}`
  return full
}

// "HH:MM" in Istanbul time for an ISO timestamp.
export function fmtTime(iso) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

// True if a slot belongs to the daytime window [05:00, 22:30) in Istanbul.
// The 22:30–05:00 overnight window is reserved for the single night block, so
// those slots are hidden from the day-mode list.
export function isDaytimeSlot(iso) {
  const [h, m] = fmtTime(iso).split(':').map(Number)
  const mins = h * 60 + m
  return mins >= 5 * 60 && mins < 22 * 60 + 30
}

// "HH:MM – HH:MM" spanning from the first slot's start to 30 min after the last.
export function fmtRange(slotISOs) {
  if (!slotISOs || slotISOs.length === 0) return ''
  const start = new Date(slotISOs[0])
  const lastStart = new Date(slotISOs[slotISOs.length - 1])
  const end = new Date(lastStart.getTime() + 30 * 60 * 1000)
  return `${fmtTime(start.toISOString())} – ${fmtTime(end.toISOString())}`
}

export function isPast(iso) {
  return new Date(iso).getTime() <= Date.now()
}

// "Sal 10 Ağu" style date label in Istanbul for an ISO timestamp.
export function fmtDate(iso) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

// True if `now` falls within [firstSlotStart, lastSlotStart + 30min).
export function isLiveNow(slotISOs) {
  if (!slotISOs || slotISOs.length === 0) return false
  const start = new Date(slotISOs[0]).getTime()
  const end = new Date(slotISOs[slotISOs.length - 1]).getTime() + 30 * 60 * 1000
  const now = Date.now()
  return start <= now && now < end
}

// A reservation is fully in the past once its last slot has ended.
export function isReservationPast(slotISOs) {
  if (!slotISOs || slotISOs.length === 0) return false
  const end = new Date(slotISOs[slotISOs.length - 1]).getTime() + 30 * 60 * 1000
  return end <= Date.now()
}

export const DURATION_LABELS = ['30 dk', '1 saat', '1,5 saat', '2 saat']

// Human label for a day-mode selection of 1-4 slots.
export function durationLabel(numSlots) {
  return DURATION_LABELS[numSlots - 1] || `${numSlots} slot`
}
