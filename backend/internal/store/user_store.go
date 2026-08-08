package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/model"
)

func GetUserByLicensePlate(pool *pgxpool.Pool, licensePlate string) (model.User, error) {
	var u model.User
	err := pool.QueryRow(context.Background(),
		"SELECT id, name, surname, role, license_plate, pin_hash FROM users WHERE license_plate = $1",
		licensePlate).Scan(&u.ID, &u.Name, &u.Surname, &u.Role, &u.LicensePlate, &u.PinHash)
	if err != nil {
		return model.User{}, err
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
	var u model.User
	err := pool.QueryRow(context.Background(),
		"SELECT id, name, surname, role, license_plate, pin_hash FROM users WHERE id = $1",
		id).Scan(&u.ID, &u.Name, &u.Surname, &u.Role, &u.LicensePlate, &u.PinHash)
	if err != nil {
		return model.User{}, err
	}
	return u, nil
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
