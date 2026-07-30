package main

import (
	"fmt"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
	"log"
)

func main() {
	_, err := store.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	fmt.Println("Successfully connected to the database")
}
