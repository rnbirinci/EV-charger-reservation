package model

type Device struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Address  string  `json:"address"`
	Power    int     `json:"power"`
	Location string  `json:"location"`
	Price    float64 `json:"price"`
}
