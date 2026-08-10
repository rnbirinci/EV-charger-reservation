package model

import "time"

type Device struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Address  string  `json:"address"`
	Power    int     `json:"power"`
	Location string  `json:"location"`
	Price    float64 `json:"price"`
}

type Slot struct {
	Time   time.Time `json:"time"`
	IsBusy bool      `json:"is_busy"`
	// Who holds the slot — only set on busy slots, only sent to authenticated
	// callers (GET /api/slots requires auth).
	UserName     string `json:"user_name,omitempty"`
	LicensePlate string `json:"license_plate,omitempty"`
}

type User struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Surname      string `json:"surname"`
	Role         string `json:"role"`
	LicensePlate string `json:"license_plate"`
	PinHash      string `json:"-"`
	// PinSet is false for an admin-invited or admin-reset account that hasn't
	// chosen a PIN yet (pin_hash is NULL). Such a user sets their PIN on first
	// login rather than entering one.
	PinSet bool `json:"pin_set"`
}

type Reservation struct {
	ID        int         `json:"id"`
	CreatedAt time.Time   `json:"created_at"`
	Slots     []time.Time `json:"slots"`
}

// AdminReservation is what GET /api/admin/reservations returns: a
// reservation with the owning user's identity attached, so an admin can see
// who booked what.
type AdminReservation struct {
	ID           int         `json:"id"`
	UserID       int         `json:"user_id"`
	UserName     string      `json:"user_name"`
	LicensePlate string      `json:"license_plate"`
	CreatedAt    time.Time   `json:"created_at"`
	Slots        []time.Time `json:"slots"`
}

// RefreshToken mirrors a row in refresh_tokens. RevokedAt is a pointer
// because the column is nullable: nil means "still valid", a non-nil time
// means "used or logged out at that moment".
type RefreshToken struct {
	ID        int        `json:"id"`
	UserID    int        `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}
