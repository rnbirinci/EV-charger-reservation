package store

import (
	"context"
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
