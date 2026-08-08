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
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	start, err := time.Parse(time.RFC3339, req.Start)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid start, expected RFC3339 e.g. 2026-08-10T14:00:00Z")
		return
	}

	id, err := service.CreateReservation(s.pool, userIDFromContext(r), start, req.NumSlots)
	if err != nil {
		writeReservationError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]int{"id": id})
}

// writeReservationError maps a service-layer error to the right HTTP status:
// bad input is 400, rule conflicts (already booked, already at the limit)
// are 409, anything unexpected is 500.
func writeReservationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidSlotCount), errors.Is(err, service.ErrPastReservation):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrTooManyActive), errors.Is(err, service.ErrSlotTaken):
		writeError(w, http.StatusConflict, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "http error")
	}
}

func (s *Server) getMyReservations(w http.ResponseWriter, r *http.Request) {
	reservations, err := store.GetReservationsByUser(s.pool, userIDFromContext(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	writeJSON(w, http.StatusOK, reservations)
}

func (s *Server) cancelReservation(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid reservation id")
		return
	}

	isAdmin := roleFromContext(r) == "admin"
	deleted, err := store.DeleteReservation(s.pool, id, userIDFromContext(r), isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	if !deleted {
		writeError(w, http.StatusNotFound, "reservation not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
