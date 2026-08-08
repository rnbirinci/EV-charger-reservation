// Plaka ve PIN alır, doğrular, rastgele refresh token üretir, refresh'in hash'ini kaydeder ve ikisini JSON'da döner.

package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
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

type loginRequest struct { // gelen JSON
	LicensePlate string `json:"license_plate"`
	Pin          string `json:"pin"`
}

type loginResponse struct { // giden JSON
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) { // Gelen isteğin gövdesini loginRequest'e doldurur
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := store.GetUserByLicensePlate(s.pool, req.LicensePlate)
	if err != nil {
		http.Error(w, "invalid license plate or pin", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PinHash), []byte(req.Pin)); err != nil {
		http.Error(w, "invalid license plate or pin", http.StatusUnauthorized)
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		http.Error(w, "server misconfigured", http.StatusInternalServerError)
		return
	}

	claims := jwt.MapClaims{ // JWT üret
		"sub":  strconv.Itoa(user.ID),
		"role": user.Role,
		"exp":  time.Now().Add(accessTokenTTL).Unix(),
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		http.Error(w, "could not create access token", http.StatusInternalServerError)
		return
	}

	refreshToken, refreshHash, err := newRefreshToken() //refresh token üret
	if err != nil {
		http.Error(w, "could not create refresh token", http.StatusInternalServerError)
		return
	}

	err = store.SaveRefreshToken(s.pool, user.ID, refreshHash, time.Now().Add(refreshTokenTTL)) // refresh token'ın hash'ini kaydet
	if err != nil {
		http.Error(w, "could not save session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json") // JSON olarak döndür
	json.NewEncoder(w).Encode(loginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
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

	sum := sha256.Sum256([]byte(token))
	hash = hex.EncodeToString(sum[:])

	return token, hash, nil
}
