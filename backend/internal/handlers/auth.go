package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rnbirinci/EV-charger-reservation/internal/store"
	"golang.org/x/crypto/bcrypt"
)

const (
	accessTokenTTL  = 15 * time.Minute   // kısa ömürlü
	refreshTokenTTL = 7 * 24 * time.Hour // uzun ömürlü
)

type loginRequest struct {
	LicensePlate string `json:"license_plate"`
	Pin          string `json:"pin"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Throttle brute-forcing of the 4-digit PIN: too many failed attempts for
	// a plate locks that plate out for a while.
	key := normalizePlate(req.LicensePlate)
	if !s.limiter.allowed(key) {
		writeError(w, http.StatusTooManyRequests, "too many attempts; try again later")
		return
	}

	user, err := store.GetUserByLicensePlate(s.pool, key)
	if err != nil {
		s.limiter.recordFailure(key)
		writeError(w, http.StatusUnauthorized, "invalid license plate or pin")
		return
	}

	// Invited/reset account with no PIN yet — the client should send them to
	// the set-PIN flow instead of asking for a PIN.
	if !user.PinSet {
		writeError(w, http.StatusConflict, "no pin set for this account")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(req.Pin)); err != nil {
		s.limiter.recordFailure(key)
		writeError(w, http.StatusUnauthorized, "invalid license plate or pin")
		return
	}

	s.limiter.reset(key)

	access, refresh, err := s.issueTokens(user.ID, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{AccessToken: access, RefreshToken: refresh})
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	rt, err := store.GetRefreshTokenByHash(s.pool, hashToken(req.RefreshToken))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	if rt.RevokedAt != nil {
		// This token was already used (login/refresh always revokes the old
		// token as it hands out a new one) or explicitly logged out.
		// Seeing it again means it leaked — kill every session this user
		// has, not just this one.
		_ = store.RevokeAllUserRefreshTokens(s.pool, rt.UserID)
		writeError(w, http.StatusUnauthorized, "refresh token already used; all sessions revoked")
		return
	}
	if time.Now().After(rt.ExpiresAt) {
		writeError(w, http.StatusUnauthorized, "refresh token expired")
		return
	}

	user, err := store.GetUserByID(s.pool, rt.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}

	if err := store.RevokeRefreshToken(s.pool, rt.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not rotate session")
		return
	}

	access, newRefresh, err := s.issueTokens(user.ID, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{AccessToken: access, RefreshToken: newRefresh})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// If the token doesn't exist, there's nothing to revoke — either way,
	// the end state the caller wanted (this token can't be used again) is
	// already true, so this always reports success.
	if rt, err := store.GetRefreshTokenByHash(s.pool, hashToken(req.RefreshToken)); err == nil {
		_ = store.RevokeRefreshToken(s.pool, rt.ID)
	}

	w.WriteHeader(http.StatusNoContent)
}

// issueTokens signs a new access token and generates a new refresh token
// (storing only its hash), for use right after login or a successful
// refresh.
func (s *Server) issueTokens(userID int, role string) (access, refresh string, err error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", "", errors.New("JWT_SECRET is not set")
	}

	claims := jwt.MapClaims{
		"sub":  strconv.Itoa(userID),
		"role": role,
		"exp":  time.Now().Add(accessTokenTTL).Unix(),
	}
	access, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return "", "", err
	}

	refresh, refreshHash, err := newRefreshToken()
	if err != nil {
		return "", "", err
	}
	if err := store.SaveRefreshToken(s.pool, userID, refreshHash, time.Now().Add(refreshTokenTTL)); err != nil {
		return "", "", err
	}

	return access, refresh, nil
}

// newRefreshToken returns a random opaque token to send to the client, and
// the SHA-256 hash of it to store in the database. Unlike PINs (compared via
// bcrypt against a single known user), a refresh token has to be looked up
// by its hash directly, so the hash must be deterministic — bcrypt salts
// each hash differently on purpose, which makes it unsuitable here.
func newRefreshToken() (token string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(buf)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// authStatus lets the login screen decide whether to ask for a PIN (active
// account) or to offer the set-PIN flow (invited/reset account).
func (s *Server) authStatus(w http.ResponseWriter, r *http.Request) {
	plate := normalizePlate(r.URL.Query().Get("license_plate"))
	if plate == "" {
		writeError(w, http.StatusBadRequest, "license_plate is required")
		return
	}
	status := "unknown"
	if user, err := store.GetUserByLicensePlate(s.pool, plate); err == nil {
		if user.PinSet {
			status = "active"
		} else {
			status = "needs_pin"
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": status})
}

// setPin sets the PIN for an invited/reset account and logs the user in. The
// store's `pin_hash IS NULL` guard ensures an already-active account can't be
// taken over here.
func (s *Server) setPin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !isValidPin(req.Pin) {
		writeError(w, http.StatusBadRequest, "pin must be exactly 4 digits")
		return
	}
	plate := normalizePlate(req.LicensePlate)

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Pin), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not set pin")
		return
	}
	ok, err := store.SetPin(s.pool, plate, string(hash))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not set pin")
		return
	}
	if !ok {
		// Either no such plate, or the account already has a PIN.
		writeError(w, http.StatusConflict, "this account already has a pin, or does not exist")
		return
	}

	user, err := store.GetUserByLicensePlate(s.pool, plate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "http error")
		return
	}
	access, refresh, err := s.issueTokens(user.ID, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}
	writeJSON(w, http.StatusOK, tokenResponse{AccessToken: access, RefreshToken: refresh})
}

// normalizePlate removes all whitespace and uppercases, so "34 abc 123" and
// "34ABC123" resolve to the same account.
func normalizePlate(s string) string {
	return strings.ToUpper(strings.Join(strings.Fields(s), ""))
}

func isValidPin(pin string) bool {
	if len(pin) != 4 {
		return false
	}
	for _, c := range pin {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
