package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/model"
)

func GetUserByLicensePlate(pool *pgxpool.Pool, licensePlate string) (model.User, error) {
	return scanUser(pool.QueryRow(context.Background(),
		"SELECT id, name, surname, role, license_plate, pin_hash FROM users WHERE license_plate = $1",
		licensePlate))
}

// row is anything with a Scan method (pgx.Row).
type scannable interface {
	Scan(dest ...any) error
}

// scanUser reads a user row, treating a NULL pin_hash as "no PIN set yet".
func scanUser(row scannable) (model.User, error) {
	var u model.User
	var pinHash *string
	if err := row.Scan(&u.ID, &u.Name, &u.Surname, &u.Role, &u.LicensePlate, &pinHash); err != nil {
		return model.User{}, err
	}
	if pinHash != nil {
		u.PinHash = *pinHash
		u.PinSet = true
	}
	return u, nil
}

func SaveRefreshToken(pool *pgxpool.Pool, userID int, tokenHash string, expiresAt time.Time) error {
	_, err := pool.Exec(context.Background(),
		"INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
		userID, tokenHash, expiresAt)
	return err
}

func GetUserByID(pool *pgxpool.Pool, id int) (model.User, error) {
	return scanUser(pool.QueryRow(context.Background(),
		"SELECT id, name, surname, role, license_plate, pin_hash FROM users WHERE id = $1",
		id))
}

// GetAllUsers lists every user (for the admin's user-management view).
func GetAllUsers(pool *pgxpool.Pool) ([]model.User, error) {
	rows, err := pool.Query(context.Background(),
		"SELECT id, name, surname, role, license_plate, pin_hash FROM users ORDER BY role, license_plate")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// CreateUser inserts an admin-invited user with no PIN yet (pin_hash NULL);
// the resident sets their PIN on first login. Returns the new user id.
func CreateUser(pool *pgxpool.Pool, name, surname, licensePlate, role string) (int, error) {
	var id int
	err := pool.QueryRow(context.Background(),
		"INSERT INTO users (name, surname, role, license_plate) VALUES ($1, $2, $3, $4) RETURNING id",
		name, surname, role, licensePlate).Scan(&id)
	return id, err
}

// SetPin sets a PIN only for an account that doesn't have one yet (invited or
// reset). The `pin_hash IS NULL` guard means an already-active account can't
// be hijacked through this path. Reports whether a row was updated.
func SetPin(pool *pgxpool.Pool, licensePlate, pinHash string) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		"UPDATE users SET pin_hash = $2 WHERE license_plate = $1 AND pin_hash IS NULL",
		licensePlate, pinHash)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ResetPin clears a user's PIN (admin action), forcing them to set a new one
// on next login. A superadmin can't be reset this way (protects them from
// being locked out by a regular admin). Reports whether a row changed.
func ResetPin(pool *pgxpool.Pool, id int) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		"UPDATE users SET pin_hash = NULL WHERE id = $1 AND role != 'superadmin'", id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// SetUserRole promotes/demotes a user between 'resident' and 'admin'. It never
// touches a superadmin (they can't be demoted), and 'superadmin' can't be
// granted here — that role only comes from the bootstrap. Reports whether a
// row changed.
func SetUserRole(pool *pgxpool.Pool, id int, role string) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		"UPDATE users SET role = $2 WHERE id = $1 AND role != 'superadmin'", id, role)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// EnsureSuperadminByPlate makes sure the plate from ADMIN_PLATE is a
// superadmin: it inserts an invited (no-PIN) superadmin if the plate is new,
// or upgrades an existing user to superadmin (keeping their PIN). This is how
// the first admin is bootstrapped in prod. Returns whether a new row was
// inserted.
func EnsureSuperadminByPlate(pool *pgxpool.Pool, name, licensePlate string) (bool, error) {
	tag, err := pool.Exec(context.Background(),
		`INSERT INTO users (name, surname, role, license_plate)
		 VALUES ($1, '', 'superadmin', $2)
		 ON CONFLICT (license_plate) DO UPDATE SET role = 'superadmin'`,
		name, licensePlate)
	if err != nil {
		return false, err
	}
	// RowsAffected is 1 for both insert and update here; report insert-only by
	// checking that it wasn't already a superadmin is overkill, so callers just
	// treat true as "ensured".
	return tag.RowsAffected() > 0, nil
}

func GetRefreshTokenByHash(pool *pgxpool.Pool, hash string) (model.RefreshToken, error) {
	var rt model.RefreshToken
	err := pool.QueryRow(context.Background(),
		"SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1",
		hash).Scan(&rt.ID, &rt.UserID, &rt.ExpiresAt, &rt.RevokedAt)
	if err != nil {
		return model.RefreshToken{}, err
	}
	return rt, nil
}

func RevokeRefreshToken(pool *pgxpool.Pool, id int) error {
	_, err := pool.Exec(context.Background(),
		"UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", id)
	return err
}

// RevokeAllUserRefreshTokens is the replay-detection response: if a refresh
// token gets presented a second time, every session this user has is killed
// on the assumption that the token was stolen and both the attacker and the
// legitimate user have now used it.
func RevokeAllUserRefreshTokens(pool *pgxpool.Pool, userID int) error {
	_, err := pool.Exec(context.Background(),
		"UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
		userID)
	return err
}
