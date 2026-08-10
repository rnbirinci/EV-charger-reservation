package service

import (
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

// These are integration tests: they run against a real Postgres (the same
// one docker compose brings up for local dev), because the business rules
// they check — no double booking, max active reservations — only mean
// something once the DB's UNIQUE constraint and transactions are in the
// loop too. They're skipped if DB_URL isn't set.

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	if os.Getenv("DB_URL") == "" {
		t.Skip("DB_URL not set; run `docker compose up -d db` and set DB_URL to run these tests")
	}
	pool, err := store.Connect()
	if err != nil {
		t.Fatalf("could not connect to test database: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func testUserID(t *testing.T, pool *pgxpool.Pool, plate string) int {
	t.Helper()
	user, err := store.GetUserByLicensePlate(pool, plate)
	if err != nil {
		t.Fatalf("could not find seeded test user %s: %v", plate, err)
	}
	return user.ID
}

// cleanupReservations makes sure userID has no reservations left over from a
// previous (e.g. failed) test run, and deletes whatever the test itself
// creates once it finishes.
func cleanupReservations(t *testing.T, pool *pgxpool.Pool, userID int) {
	t.Helper()
	clear := func() {
		reservations, err := store.GetReservationsByUser(pool, userID)
		if err != nil {
			t.Logf("cleanup: could not list reservations: %v", err)
			return
		}
		for _, res := range reservations {
			if _, err := store.DeleteReservation(pool, res.ID, userID, false); err != nil {
				t.Logf("cleanup: could not delete reservation %d: %v", res.ID, err)
			}
		}
	}
	clear()
	t.Cleanup(clear)
}

func TestCreateReservation(t *testing.T) {
	pool := testPool(t)
	userID := testUserID(t, pool, "34ABC003") // Fatma; a resident not used by other manual tests
	cleanupReservations(t, pool, userID)

	// Anchor to midnight UTC three days out; `at` builds slot times off it.
	// slotKind reads whatever clock a time carries, so UTC clock hours map to
	// the day/night windows directly.
	now := time.Now().UTC()
	base := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, 3)
	at := func(h, m int) time.Time {
		return base.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute)
	}

	t.Run("single daytime slot succeeds", func(t *testing.T) {
		id, err := CreateReservation(pool, userID, at(8, 0), 1)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		defer store.DeleteReservation(pool, id, userID, false)
	})

	t.Run("four daytime slots (the max) succeeds", func(t *testing.T) {
		id, err := CreateReservation(pool, userID, at(10, 0), 4)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		defer store.DeleteReservation(pool, id, userID, false)
	})

	t.Run("five daytime slots is rejected", func(t *testing.T) {
		_, err := CreateReservation(pool, userID, at(13, 0), 5)
		if !errors.Is(err, ErrInvalidSlotCount) {
			t.Fatalf("expected ErrInvalidSlotCount, got %v", err)
		}
	})

	t.Run("zero slots is rejected", func(t *testing.T) {
		_, err := CreateReservation(pool, userID, at(15, 0), 0)
		if !errors.Is(err, ErrInvalidSlotCount) {
			t.Fatalf("expected ErrInvalidSlotCount, got %v", err)
		}
	})

	t.Run("the whole night 22:30-06:00 (15 slots) succeeds", func(t *testing.T) {
		id, err := CreateReservation(pool, userID, at(22, 30), 15)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		defer store.DeleteReservation(pool, id, userID, false)
	})

	t.Run("a partial night range succeeds", func(t *testing.T) {
		// 00:00 -> 03:00 (6 slots), all inside the night window.
		id, err := CreateReservation(pool, userID, at(24, 0), 6)
		if err != nil {
			t.Fatalf("expected success, got %v", err)
		}
		defer store.DeleteReservation(pool, id, userID, false)
	})

	t.Run("a night range past 06:00 is rejected", func(t *testing.T) {
		// 22:30 + 16 slots would reach 06:00, which is unbookable.
		_, err := CreateReservation(pool, userID, at(22, 30), 16)
		if !errors.Is(err, ErrInvalidSlotCount) {
			t.Fatalf("expected ErrInvalidSlotCount, got %v", err)
		}
	})

	t.Run("an unbookable 06:00 slot is rejected", func(t *testing.T) {
		_, err := CreateReservation(pool, userID, at(6, 0), 1)
		if !errors.Is(err, ErrInvalidSlotCount) {
			t.Fatalf("expected ErrInvalidSlotCount, got %v", err)
		}
	})

	t.Run("a reservation straddling day and night is rejected", func(t *testing.T) {
		// 21:30,22:00 (day) then 22:30,23:00 (night) — spans both windows.
		_, err := CreateReservation(pool, userID, at(21, 30), 4)
		if !errors.Is(err, ErrInvalidSlotCount) {
			t.Fatalf("expected ErrInvalidSlotCount, got %v", err)
		}
	})

	t.Run("a start time in the past is rejected", func(t *testing.T) {
		_, err := CreateReservation(pool, userID, time.Now().Add(-1*time.Hour), 1)
		if !errors.Is(err, ErrPastReservation) {
			t.Fatalf("expected ErrPastReservation, got %v", err)
		}
	})

	t.Run("double booking the same slot is rejected", func(t *testing.T) {
		start := at(12, 0)
		id, err := CreateReservation(pool, userID, start, 1)
		if err != nil {
			t.Fatalf("first booking should succeed, got %v", err)
		}
		defer store.DeleteReservation(pool, id, userID, false)

		if _, err := CreateReservation(pool, userID, start, 1); !errors.Is(err, ErrSlotTaken) {
			t.Fatalf("expected ErrSlotTaken, got %v", err)
		}
	})

	t.Run("a third active reservation is rejected", func(t *testing.T) {
		id1, err := CreateReservation(pool, userID, at(9, 0), 1)
		if err != nil {
			t.Fatalf("1st reservation should succeed, got %v", err)
		}
		defer store.DeleteReservation(pool, id1, userID, false)

		id2, err := CreateReservation(pool, userID, at(11, 0), 1)
		if err != nil {
			t.Fatalf("2nd reservation should succeed, got %v", err)
		}
		defer store.DeleteReservation(pool, id2, userID, false)

		if _, err := CreateReservation(pool, userID, at(13, 30), 1); !errors.Is(err, ErrTooManyActive) {
			t.Fatalf("expected ErrTooManyActive, got %v", err)
		}
	})

	t.Run("cancelling a reservation frees its slot for rebooking", func(t *testing.T) {
		start := at(14, 0)
		id, err := CreateReservation(pool, userID, start, 1)
		if err != nil {
			t.Fatalf("booking should succeed, got %v", err)
		}

		if deleted, err := store.DeleteReservation(pool, id, userID, false); err != nil || !deleted {
			t.Fatalf("cancel should succeed, got deleted=%v err=%v", deleted, err)
		}

		id2, err := CreateReservation(pool, userID, start, 1)
		if err != nil {
			t.Fatalf("rebooking a freed slot should succeed, got %v", err)
		}
		defer store.DeleteReservation(pool, id2, userID, false)
	})
}
