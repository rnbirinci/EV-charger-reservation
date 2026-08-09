package main

import (
	"log"
	"net/http"
	"os"

	"github.com/rnbirinci/EV-charger-reservation/internal/handlers"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

func main() {
	// Fail fast on a missing signing secret rather than starting a server that
	// can't issue or verify tokens (and would fall back to an empty key).
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET is not set")
	}

	pool, err := store.Connect() // Havuzu aç
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	log.Println("Successfully connected to the database")

	// Bootstrap the first admin: if ADMIN_PLATE is set, make sure that plate is
	// a superadmin (created with no PIN if new). They set their own PIN on
	// first login, so no password is ever stored in the repo or image.
	if plate := os.Getenv("ADMIN_PLATE"); plate != "" {
		if _, err := store.EnsureSuperadminByPlate(pool, os.Getenv("ADMIN_NAME"), plate); err != nil {
			log.Fatalf("Failed to bootstrap superadmin: %v", err)
		}
		log.Printf("Ensured superadmin for plate %s", plate)
	}

	mux := handlers.NewRouter(pool)              // mux kur
	log.Fatal(http.ListenAndServe(":8080", mux)) // Dinlemeye başla
}
