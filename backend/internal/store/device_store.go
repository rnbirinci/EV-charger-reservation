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

// BusySlot is a taken slot together with who reserved it.
type BusySlot struct {
	Start        time.Time
	UserName     string
	LicensePlate string
}

// GetBusySlots returns the taken slots for the day starting at `date`, each
// with the reserving resident's name and plate.
func GetBusySlots(pool *pgxpool.Pool, date time.Time) ([]BusySlot, error) {
	rows, err := pool.Query(context.Background(), `
		SELECT sr.start_time, u.name || ' ' || u.surname, u.license_plate
		FROM slot_reservations sr
		JOIN reservations r ON r.id = sr.reservation_id
		JOIN users u ON u.id = r.user_id
		WHERE sr.start_time >= $1 AND sr.start_time < $2`,
		date, date.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []BusySlot
	for rows.Next() {
		var b BusySlot
		if err := rows.Scan(&b.Start, &b.UserName, &b.LicensePlate); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
