package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/model"
)

// CreateReservation inserts a reservation and all of its slots in a single
// transaction: either every slot is booked, or none is. The overlap rule
// itself ("no two reservations for the same slot") is enforced by the
// UNIQUE constraint on slot_reservations.start_time — if a concurrent
// request already took one of these slots, the INSERT below fails, the
// transaction rolls back, and IsUniqueViolation(err) tells the caller why.
func CreateReservation(pool *pgxpool.Pool, userID int, times []time.Time) (int, error) {
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) // no-op once Commit has succeeded

	var reservationID int
	err = tx.QueryRow(ctx,
		"INSERT INTO reservations (user_id) VALUES ($1) RETURNING id",
		userID).Scan(&reservationID)
	if err != nil {
		return 0, err
	}

	for _, t := range times {
		_, err = tx.Exec(ctx,
			"INSERT INTO slot_reservations (reservation_id, start_time) VALUES ($1, $2)",
			reservationID, t)
		if err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return reservationID, nil
}

// IsUniqueViolation reports whether err is a Postgres unique-constraint
// error (SQLSTATE 23505) — i.e. someone already holds this slot.
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

// CountActiveReservations counts reservations belonging to userID that
// haven't fully ended yet (at least one of their slots ends in the future).
func CountActiveReservations(pool *pgxpool.Pool, userID int) (int, error) {
	var count int
	err := pool.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM reservations r
		WHERE r.user_id = $1
		AND EXISTS (
			SELECT 1 FROM slot_reservations sr
			WHERE sr.reservation_id = r.id
			AND sr.start_time + interval '30 minutes' > now()
		)`, userID).Scan(&count)
	return count, err
}

// GetReservationsByUser returns userID's reservations, each with its list of
// slot start times attached.
func GetReservationsByUser(pool *pgxpool.Pool, userID int) ([]model.Reservation, error) {
	rows, err := pool.Query(context.Background(), `
		SELECT r.id, r.created_at, sr.start_time
		FROM reservations r
		JOIN slot_reservations sr ON sr.reservation_id = r.id
		WHERE r.user_id = $1
		ORDER BY r.id, sr.start_time`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Non-nil so an empty result serializes as [] rather than null.
	result := []model.Reservation{}
	for rows.Next() {
		var id int
		var createdAt, slotTime time.Time
		if err := rows.Scan(&id, &createdAt, &slotTime); err != nil {
			return nil, err
		}
		if len(result) == 0 || result[len(result)-1].ID != id {
			result = append(result, model.Reservation{ID: id, CreatedAt: createdAt})
		}
		last := &result[len(result)-1]
		last.Slots = append(last.Slots, slotTime)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

// GetAllReservations returns every reservation in the system with its
// owner's identity attached, for the admin view.
func GetAllReservations(pool *pgxpool.Pool) ([]model.AdminReservation, error) {
	rows, err := pool.Query(context.Background(), `
		SELECT r.id, r.user_id, u.name || ' ' || u.surname, u.license_plate, r.created_at, sr.start_time
		FROM reservations r
		JOIN users u ON u.id = r.user_id
		JOIN slot_reservations sr ON sr.reservation_id = r.id
		ORDER BY r.id, sr.start_time`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Non-nil so an empty result serializes as [] rather than null.
	result := []model.AdminReservation{}
	for rows.Next() {
		var id, userID int
		var userName, plate string
		var createdAt, slotTime time.Time
		if err := rows.Scan(&id, &userID, &userName, &plate, &createdAt, &slotTime); err != nil {
			return nil, err
		}
		if len(result) == 0 || result[len(result)-1].ID != id {
			result = append(result, model.AdminReservation{
				ID:           id,
				UserID:       userID,
				UserName:     userName,
				LicensePlate: plate,
				CreatedAt:    createdAt,
			})
		}
		last := &result[len(result)-1]
		last.Slots = append(last.Slots, slotTime)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

// DeleteReservation removes a reservation (and, via ON DELETE CASCADE, its
// slots). Residents may only delete their own; admins may delete any. It
// reports whether a row was actually deleted, so the handler can tell "not
// found" apart from "deleted".
func DeleteReservation(pool *pgxpool.Pool, reservationID, userID int, isAdmin bool) (bool, error) {
	var tag pgconn.CommandTag
	var err error
	if isAdmin {
		tag, err = pool.Exec(context.Background(),
			"DELETE FROM reservations WHERE id = $1", reservationID)
	} else {
		tag, err = pool.Exec(context.Background(),
			"DELETE FROM reservations WHERE id = $1 AND user_id = $2", reservationID, userID)
	}
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}
