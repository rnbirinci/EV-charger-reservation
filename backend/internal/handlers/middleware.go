package handlers

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	userIDContextKey contextKey = "userID"
	roleContextKey   contextKey = "role"
)

// requireAuth wraps a handler so it only runs if the request carries a valid
// access token. On success it stashes the user id and role on the request's
// context, where the wrapped handler can read them back with
// userIDFromContext / roleFromContext.
func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenString, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || tokenString == "" {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}

		secret := os.Getenv("JWT_SECRET")
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "invalid or expired token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}
		sub, _ := claims["sub"].(string)
		userID, err := strconv.Atoi(sub)
		if err != nil {
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}
		role, _ := claims["role"].(string)

		ctx := context.WithValue(r.Context(), userIDContextKey, userID)
		ctx = context.WithValue(ctx, roleContextKey, role)
		next(w, r.WithContext(ctx))
	}
}

func userIDFromContext(r *http.Request) int {
	id, _ := r.Context().Value(userIDContextKey).(int)
	return id
}

func roleFromContext(r *http.Request) string {
	role, _ := r.Context().Value(roleContextKey).(string)
	return role
}
