// Single place that talks to the backend. Handles token storage, attaches the
// bearer token to protected calls, and transparently refreshes an expired
// access token once before giving up.

const ACCESS_KEY = 'suhube_access'
const REFRESH_KEY = 'suhube_refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set({ access_token, refresh_token }) {
    localStorage.setItem(ACCESS_KEY, access_token)
    localStorage.setItem(REFRESH_KEY, refresh_token)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// The backend returns errors as {"error": "..."}. ApiError carries that
// message plus the HTTP status so screens can react to specific cases.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Reads the (unverified) payload of the JWT so the UI can show the right tab
// for admins. Trust for anything real still lives on the backend — this only
// decides what to render.
export function decodeToken(access) {
  if (!access) return null
  try {
    const payload = access.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function parseError(res) {
  try {
    const body = await res.json()
    return body.error || res.statusText
  } catch {
    return res.statusText
  }
}

// Core request helper. `auth: true` attaches the access token and, on a 401,
// tries a token refresh once and replays the request.
async function request(path, { method = 'GET', body, auth = false, _retried = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && tokens.access) headers['Authorization'] = `Bearer ${tokens.access}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth && !_retried && tokens.refresh) {
    const refreshed = await tryRefresh()
    if (refreshed) return request(path, { method, body, auth, _retried: true })
  }

  if (!res.ok) throw new ApiError(res.status, await parseError(res))
  if (res.status === 204) return null
  return res.json()
}

async function tryRefresh() {
  try {
    const data = await request('/refresh', { method: 'POST', body: { refresh_token: tokens.refresh } })
    tokens.set(data)
    return true
  } catch {
    tokens.clear()
    return false
  }
}

export const api = {
  async login(licensePlate, pin) {
    const data = await request('/login', {
      method: 'POST',
      body: { license_plate: licensePlate, pin },
    })
    tokens.set(data)
    return decodeToken(data.access_token)
  },

  async logout() {
    const refresh = tokens.refresh
    tokens.clear()
    if (refresh) {
      try {
        await request('/logout', { method: 'POST', body: { refresh_token: refresh } })
      } catch {
        // best-effort; local tokens are already gone
      }
    }
  },

  getSlots(date) {
    return request(`/slots?date=${date}`)
  },

  getDevice() {
    return request('/device')
  },

  createReservation(startISO, numSlots) {
    return request('/reservations', {
      method: 'POST',
      auth: true,
      body: { start: startISO, num_slots: numSlots },
    })
  },

  getMyReservations() {
    return request('/reservations/mine', { auth: true })
  },

  cancelReservation(id) {
    return request(`/reservations/${id}`, { method: 'DELETE', auth: true })
  },

  getAllReservations() {
    return request('/admin/reservations', { auth: true })
  },
}
