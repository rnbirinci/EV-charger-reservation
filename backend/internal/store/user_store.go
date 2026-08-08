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
