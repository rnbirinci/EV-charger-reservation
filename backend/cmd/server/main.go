package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

func selamla(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "calisiyor!")
}

func main() {
	_, err := store.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	fmt.Println("Successfully connected to the database")

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", selamla)

	log.Fatal(http.ListenAndServe(":8080", mux))
}
