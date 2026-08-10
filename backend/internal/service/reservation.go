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
	ErrInvalidSlotCount = errors.New("invalid reservation: daytime is 06:30-22:00 (max 4 slots / 2 hours), night is 22:30-06:00 (any length); slots must be contiguous and stay within one window")
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

// validWindow requires every slot to fall in the same window: all daytime
// (then at most 4 slots) or all night (any length — the 22:30-06:00 window
// only holds 15 slots, so it's self-capping). A reservation may not straddle
// the two windows or include an unbookable slot.
func validWindow(times []time.Time) bool {
	allDay, allNight := true, true
	for _, t := range times {
		switch slotKind(t) {
		case kindDay:
			allNight = false
		case kindNight:
			allDay = false
		default:
			return false
		}
	}
	if allDay {
		return len(times) <= maxDaySlots
	}
	return allNight
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
