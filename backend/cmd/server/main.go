package main

import (
	"log"
	"net/http"

	"github.com/rnbirinci/EV-charger-reservation/internal/handlers"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

func main() {
	pool, err := store.Connect() // Havuzu aç
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	log.Println("Successfully connected to the database")

	mux := handlers.NewRouter(pool)              // mux kur
	log.Fatal(http.ListenAndServe(":8080", mux)) // Dinlemeye başla
}
