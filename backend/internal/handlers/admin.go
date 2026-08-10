package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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

func (s *Server) getAllUsers(w http.ResponseWriter, r *http.Request) {
	users, err := store.GetAllUsers(s.pool)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	writeJSON(w, http.StatusOK, users)
}

type createUserRequest struct {
	Name         string `json:"name"`
	Surname      string `json:"surname"`
	LicensePlate string `json:"license_plate"`
}

// createUser invites a resident: the account is created with no PIN, and the
// resident sets their own PIN on first login.
func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name := strings.TrimSpace(req.Name)
	surname := strings.TrimSpace(req.Surname)
	plate := normalizePlate(req.LicensePlate)
	if name == "" || surname == "" || plate == "" {
		writeError(w, http.StatusBadRequest, "name, surname and license_plate are required")
		return
	}

	id, err := store.CreateUser(s.pool, name, surname, plate, "resident")
	if err != nil {
		if store.IsUniqueViolation(err) {
			writeError(w, http.StatusConflict, "a user with this license plate already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "could not create user")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int{"id": id})
}

type setRoleRequest struct {
	Role string `json:"role"`
}

// setUserRole promotes a resident to admin or demotes an admin to resident.
// Superadmin-only (gated at the router). 'superadmin' can't be granted here,
// and a superadmin target can't be changed (enforced in the store).
func (s *Server) setUserRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var req setRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Role != "admin" && req.Role != "resident" {
		writeError(w, http.StatusBadRequest, "role must be 'admin' or 'resident'")
		return
	}
	ok, err := store.SetUserRole(s.pool, id, req.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "user not found or cannot be changed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// resetPin clears a user's PIN so they set a new one on next login.
func (s *Server) resetPin(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	ok, err := store.ResetPin(s.pool, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	if !ok {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
