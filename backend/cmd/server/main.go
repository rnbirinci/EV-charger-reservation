package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

func greet(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "working!")
}

func main() {
	pool, err := store.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	fmt.Println("Successfully connected to the database")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", greet)

	mux.HandleFunc("GET /api/device", func(w http.ResponseWriter, r *http.Request) {

		device, err := store.GetDevice(pool)
		if err != nil {
			http.Error(w, "http error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(device)

	})
	log.Fatal(http.ListenAndServe(":8080", mux))
}
