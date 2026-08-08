package handlers

import (
	"net/http"

	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

func (s *Server) getAllReservations(w http.ResponseWriter, r *http.Request) {
	reservations, err := store.GetAllReservations(s.pool)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	writeJSON(w, http.StatusOK, reservations)
}
