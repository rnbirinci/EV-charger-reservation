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

	user, err := store.GetUserByLicensePlate(s.pool, req.LicensePlate)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid license plate or pin")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(req.Pin)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid license plate or pin")
		return
	}

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
