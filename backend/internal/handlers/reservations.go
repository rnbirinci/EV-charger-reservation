package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/rnbirinci/EV-charger-reservation/internal/service"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

type createReservationRequest struct {
	// RFC3339, e.g. "2026-08-10T14:00:00Z" — always UTC, to match the times
	// GET /api/slots generates.
	Start    string `json:"start"`
	NumSlots int    `json:"num_slots"`
}

func (s *Server) createReservation(w http.ResponseWriter, r *http.Request) {
	var req createReservationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	start, err := time.Parse(time.RFC3339, req.Start)
	if err != nil {
		http.Error(w, "invalid start, expected RFC3339 e.g. 2026-08-10T14:00:00Z", http.StatusBadRequest)
		return
	}

	id, err := service.CreateReservation(s.pool, userIDFromContext(r), start, req.NumSlots)
	if err != nil {
		writeReservationError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int{"id": id})
}

// writeReservationError maps a service-layer error to the right HTTP status:
// bad input is 400, rule conflicts (already booked, already at the limit)
// are 409, anything unexpected is 500.
func writeReservationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidSlotCount), errors.Is(err, service.ErrPastReservation):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, service.ErrTooManyActive), errors.Is(err, service.ErrSlotTaken):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		http.Error(w, "http error", http.StatusInternalServerError)
	}
}

func (s *Server) getMyReservations(w http.ResponseWriter, r *http.Request) {
	reservations, err := store.GetReservationsByUser(s.pool, userIDFromContext(r))
	if err != nil {
		http.Error(w, "http error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reservations)
}

func (s *Server) cancelReservation(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid reservation id", http.StatusBadRequest)
		return
	}

	isAdmin := roleFromContext(r) == "admin"
	deleted, err := store.DeleteReservation(s.pool, id, userIDFromContext(r), isAdmin)
	if err != nil {
		http.Error(w, "http error", http.StatusInternalServerError)
		return
	}
	if !deleted {
		http.Error(w, "reservation not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
