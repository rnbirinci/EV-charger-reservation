package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/model"
)

func GetDevice(pool *pgxpool.Pool) (model.Device, error) {
	var device model.Device
	err := pool.QueryRow(context.Background(), "SELECT id, name, address, power, location, price FROM devices LIMIT 1").Scan(&device.ID, &device.Name, &device.Address, &device.Power, &device.Location, &device.Price)
	if err != nil {
		return model.Device{}, err // Return an empty Device struct and the error if the query fails
	}
	return device, nil
}

func GetBusySlots(pool *pgxpool.Pool, date time.Time) ([]time.Time, error) {
	rows, err := pool.Query(context.Background(),
		"SELECT start_time FROM slot_reservations WHERE start_time >= $1 AND start_time < $2",
		date, date.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var times []time.Time
	for rows.Next() {
		var t time.Time
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		times = append(times, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return times, nil
}
