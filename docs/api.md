# API

Base URL: `http://localhost:8080`

All responses are JSON. Errors are plain text with a non-2xx status code
(via Go's `http.Error`) — this will move to a JSON error body in a later pass.

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

## Not yet implemented

- `POST /api/refresh`, `POST /api/logout`
- `POST /api/reservations`, `GET /api/reservations/mine`, `DELETE /api/reservations/{id}`
- `GET /api/admin/reservations`
- Auth middleware — no endpoint currently checks the access token
