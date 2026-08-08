package service

import (
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

const (
	slotDuration           = 30 * time.Minute
	maxSlotsPerReservation = 4
	maxActiveReservations  = 2
	overnightSlotCount     = 13 // 22:30 -> 05:00 next day, the handoff's one exception to the 4-slot cap
)

var (
	ErrInvalidSlotCount = errors.New("a reservation must be 1-4 slots (30 min - 2 hours), unless it starts at 22:30 and covers the full overnight window to 05:00 (13 slots)")
	ErrPastReservation  = errors.New("cannot reserve a slot in the past")
	ErrTooManyActive    = errors.New("you already have 2 active reservations")
	ErrSlotTaken        = errors.New("one or more of these slots is already reserved")
)

// CreateReservation validates the handoff's business rules and, if they
// pass, hands off to the store to do the actual (transactional) insert.
func CreateReservation(pool *pgxpool.Pool, userID int, start time.Time, numSlots int) (int, error) {
	if !isValidSlotCount(start, numSlots) {
		return 0, ErrInvalidSlotCount
	}
	if start.Before(time.Now()) {
		return 0, ErrPastReservation
	}

	active, err := store.CountActiveReservations(pool, userID)
	if err != nil {
		return 0, err
	}
	if active >= maxActiveReservations {
		return 0, ErrTooManyActive
	}

	times := make([]time.Time, numSlots)
	for i := 0; i < numSlots; i++ {
		times[i] = start.Add(time.Duration(i) * slotDuration)
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

func isValidSlotCount(start time.Time, numSlots int) bool {
	if start.Hour() == 22 && start.Minute() == 30 {
		return numSlots == overnightSlotCount
	}
	return numSlots >= 1 && numSlots <= maxSlotsPerReservation
}
