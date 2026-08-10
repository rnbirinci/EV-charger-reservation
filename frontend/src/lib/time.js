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
// Minutes-of-day (local Istanbul) for a slot timestamp.
export function clockMinutes(iso) {
  const [h, m] = fmtTime(iso).split(':').map(Number)
  return h * 60 + m
}

// Daytime window: 06:30–22:00 (inclusive start times), max 4 slots.
export function isDaytimeSlot(iso) {
  const mins = clockMinutes(iso)
  return mins >= 6 * 60 + 30 && mins <= 22 * 60
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

// The night window is 22:30–06:00: evening slots (>= 22:30) belong to the
// selected day, morning slots (<= 05:30) to the next day.
export function isNightEveningSlot(iso) {
  return clockMinutes(iso) >= 22 * 60 + 30
}
export function isNightMorningSlot(iso) {
  return clockMinutes(iso) <= 5 * 60 + 30
}

// A reservation is a "night" one if its first slot is in the night window.
export function isNightReservation(slotISOs) {
  if (!slotISOs || slotISOs.length === 0) return false
  return isNightEveningSlot(slotISOs[0]) || isNightMorningSlot(slotISOs[0])
}

// Human duration label for any number of 30-minute slots: "30 dk", "1 saat",
// "1,5 saat", ... "6,5 saat".
export function durationLabel(numSlots) {
  const mins = numSlots * 30
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} dk`
  if (m === 0) return `${h} saat`
  return `${h},5 saat`
}
