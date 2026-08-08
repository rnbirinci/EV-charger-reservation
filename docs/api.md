# API

Base URL: `http://localhost:8080`

All responses are JSON. Errors are `{"error": "message"}` with a non-2xx
status code.

Protected endpoints require `Authorization: Bearer <access_token>`. Admin
endpoints additionally require the token's `role` claim to be `admin`.

## GET /api/health

Liveness check. No auth.

**Response `200`**

```
working!
```

## GET /api/device

Returns the site's single charging device. No auth.

**Response `200`**

```json
{
  "id": 1,
  "name": "SUHUBE EVLERİ 22kW-1",
  "address": "Kemalpaşa Mahallesi, 130. Cd, Bina No: 15",
  "power": 22,
  "location": "40.752439, 30.355499",
  "price": 9.9
}
```

## GET /api/slots?date=YYYY-MM-DD

Returns the 48 half-hour slots for the given day, each marked busy or free.
Availability is derived only from this project's own database (Phase 1 —
see Ek A/B of the handoff; Phase 2 would read the real device's live status
from the gotedygo API instead). No auth.

**Query params**
- `date` (required) — `YYYY-MM-DD`

**Response `200`**

```json
[
  { "time": "2026-08-10T00:00:00Z", "is_busy": false },
  { "time": "2026-08-10T00:30:00Z", "is_busy": false }
]
```

**Errors**
- `400` — missing or malformed `date`

## POST /api/login

Exchanges a license plate + PIN for an access token and a refresh token.

**Request**

```json
{ "license_plate": "34ABC001", "pin": "1234" }
```

**Response `200`**

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "HEcjkoPugwGvynQq8MuZLpv0z7Eb913UaGbiTAVrBQ0"
}
```

- `access_token` — JWT (HS256), contains `sub` (user id), `role`
  (`admin` | `resident`), `exp`. Valid 15 minutes.
- `refresh_token` — opaque random string. Valid 7 days. Its SHA-256 hash is
  stored in `refresh_tokens`; the plain value is only ever returned here,
  never stored.

**Errors**
- `400` — malformed request body
- `401` — unknown license plate or wrong PIN (same message for both, so a
  caller can't use the error to discover which plates are registered)

## POST /api/refresh

Exchanges a refresh token for a new access + refresh token pair (rotation:
the old refresh token stops working the moment this succeeds).

**Request**

```json
{ "refresh_token": "HEcjkoPugwGvynQq8MuZLpv0z7Eb913UaGbiTAVrBQ0" }
```

**Response `200`** — same shape as `POST /api/login`.

**Errors**
- `401` — unknown or expired refresh token
- `401` — the token was already used once before (replay). This revokes
  *every* refresh token this user has, on the assumption a used token means
  it leaked; the user has to log in again.

## POST /api/logout

Revokes a refresh token. Always returns `204`, whether or not the token was
valid — the caller's goal ("this token shouldn't work anymore") is true
either way, and a different response would let someone probe for valid
tokens.

**Request**

```json
{ "refresh_token": "HEcjkoPugwGvynQq8MuZLpv0z7Eb913UaGbiTAVrBQ0" }
```

## POST /api/reservations 🔒

Books 1-4 consecutive half-hour slots starting at `start`, or exactly 13
slots starting at `22:30` (the overnight exception, handoff §3).

**Request**

```json
{ "start": "2026-08-10T14:00:00Z", "num_slots": 2 }
```

`start` must be RFC3339, in UTC (`Z` suffix), matching the times
`GET /api/slots` generates.

**Response `201`**

```json
{ "id": 42 }
```

**Errors**
- `400` — malformed body, bad slot count, or a start time in the past
- `409` — one of the requested slots is already booked, or the caller
  already has 2 active reservations

## GET /api/reservations/mine 🔒

Lists the caller's own reservations.

**Response `200`**

```json
[
  {
    "id": 42,
    "created_at": "2026-08-08T12:00:00Z",
    "slots": ["2026-08-10T14:00:00Z", "2026-08-10T14:30:00Z"]
  }
]
```

## DELETE /api/reservations/{id} 🔒

Cancels a reservation (the row is deleted; its slots are freed via
`ON DELETE CASCADE`). Residents may only cancel their own; admins may
cancel any.

**Response `204`**

**Errors**
- `404` — no such reservation, or it belongs to someone else (same status
  for both, so a caller can't use this to discover other users' reservation
  ids)

## GET /api/admin/reservations 🔒 (admin only)

Lists every reservation in the system with the owning user's name and
license plate attached.

**Response `200`**

```json
[
  {
    "id": 42,
    "user_id": 2,
    "user_name": "Veli Kaya",
    "license_plate": "34ABC001",
    "created_at": "2026-08-08T12:00:00Z",
    "slots": ["2026-08-10T14:00:00Z"]
  }
]
```

**Errors**
- `403` — caller is authenticated but not an admin
