package service

import (
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

const (
	slotDuration          = 30 * time.Minute
	maxDaySlots           = 4 // daytime reservations: at most 2 hours
	maxActiveReservations = 2

	// Bookable windows, as minutes-of-day (local clock). Anything outside both
	// (e.g. 06:00) isn't bookable.
	dayStartMin   = 6*60 + 30  // 06:30, first daytime slot
	dayEndMin     = 22 * 60    // 22:00, last daytime slot
	nightStartMin = 22*60 + 30 // 22:30, first night slot
	nightEndMin   = 5*60 + 30  // 05:30, last night slot
)

var (
	ErrInvalidSlotCount = errors.New("invalid reservation: at most 4 daytime slots (06:30-22:00 / 2 hours); night slots (22:30-06:00) are unlimited; slots must be contiguous and bookable")
	ErrPastReservation  = errors.New("cannot reserve a slot in the past")
	ErrTooManyActive    = errors.New("you already have 2 active reservations")
	ErrSlotTaken        = errors.New("one or more of these slots is already reserved")
)

// CreateReservation validates the booking rules and, if they pass, hands off to
// the store for the transactional insert.
func CreateReservation(pool *pgxpool.Pool, userID int, start time.Time, numSlots int) (int, error) {
	if numSlots < 1 {
		return 0, ErrInvalidSlotCount
	}
	if start.Before(time.Now()) {
		return 0, ErrPastReservation
	}

	times := make([]time.Time, numSlots)
	for i := 0; i < numSlots; i++ {
		times[i] = start.Add(time.Duration(i) * slotDuration)
	}
	if !validWindow(times) {
		return 0, ErrInvalidSlotCount
	}

	active, err := store.CountActiveReservations(pool, userID)
	if err != nil {
		return 0, err
	}
	if active >= maxActiveReservations {
		return 0, ErrTooManyActive
	}

	id, err := store.CreateReservation(pool, userID, times)
	if err != nil {
		if store.IsUniqueViolation(err) {
			return 0, ErrSlotTaken
		}
		return 0, err
	}
	return id, nil
}

// validWindow caps the daytime portion of a reservation at 4 slots while
// leaving night slots unlimited. A booking may cross the day→night boundary
// (e.g. 21:30–23:00), but every slot must be bookable — an unbookable slot
// (06:00, or off the 30-minute grid) is rejected, which also stops a booking
// from spanning the 06:00 gap into the next day.
func validWindow(times []time.Time) bool {
	dayCount := 0
	for _, t := range times {
		switch slotKind(t) {
		case kindDay:
			dayCount++
		case kindNight:
			// no cap on night slots
		default:
			return false
		}
	}
	return dayCount <= maxDaySlots
}

const (
	kindDay   = "day"
	kindNight = "night"
)

func slotKind(t time.Time) string {
	m := t.Hour()*60 + t.Minute()
	if m%30 != 0 {
		return "" // not on a 30-minute boundary
	}
	if m >= dayStartMin && m <= dayEndMin {
		return kindDay
	}
	if m >= nightStartMin || m <= nightEndMin {
		return kindNight
	}
	return ""
}
