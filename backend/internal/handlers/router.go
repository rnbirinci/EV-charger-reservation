package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rnbirinci/EV-charger-reservation/internal/model"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
)

// Server holds the dependencies every handler needs. Handlers are methods on
// *Server instead of free functions so they can reach s.pool without global
// variables.
type Server struct {
	pool *pgxpool.Pool
}

func NewRouter(pool *pgxpool.Pool) *http.ServeMux {
	s := &Server{pool: pool}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/device", s.getDevice)
	mux.HandleFunc("GET /api/slots", s.getSlots)
	mux.HandleFunc("POST /api/login", s.login)
	mux.HandleFunc("POST /api/refresh", s.refresh)
	mux.HandleFunc("POST /api/logout", s.logout)

	mux.HandleFunc("POST /api/reservations", requireAuth(s.createReservation))
	mux.HandleFunc("GET /api/reservations/mine", requireAuth(s.getMyReservations))
	mux.HandleFunc("DELETE /api/reservations/{id}", requireAuth(s.cancelReservation))

	mux.HandleFunc("GET /api/admin/reservations", requireAdmin(s.getAllReservations))

	return mux
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "working!")
}

func (s *Server) getDevice(w http.ResponseWriter, r *http.Request) {
	device, err := store.GetDevice(s.pool)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	writeJSON(w, http.StatusOK, device)
}

func (s *Server) getSlots(w http.ResponseWriter, r *http.Request) {
	dateStr := r.URL.Query().Get("date")
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid date, expected format YYYY-MM-DD")
		return
	}

	busy, err := store.GetBusySlots(s.pool, date)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}

	busySet := make(map[int64]bool)
	for _, t := range busy {
		busySet[t.Unix()] = true
	}

	var slots []model.Slot
	for t := date; t.Before(date.AddDate(0, 0, 1)); t = t.Add(30 * time.Minute) {
		slots = append(slots, model.Slot{
			Time:   t,
			IsBusy: busySet[t.Unix()],
		})
	}

	writeJSON(w, http.StatusOK, slots)
}
