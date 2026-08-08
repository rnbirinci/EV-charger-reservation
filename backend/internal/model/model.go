package model

import "time"

type Device struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Address  string  `json:"address"`
	Power    int     `json:"power"`
	Location string  `json:"location"`
	Price    float64 `json:"price"`
}

type Slot struct {
	Time   time.Time `json:"time"`
	IsBusy bool      `json:"is_busy"`
}

type User struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Surname      string `json:"surname"`
	Role         string `json:"role"`
	LicensePlate string `json:"license_plate"`
	PinHash      string `json:"-"`
}

type Reservation struct {
	ID        int         `json:"id"`
	CreatedAt time.Time   `json:"created_at"`
	Slots     []time.Time `json:"slots"`
}
