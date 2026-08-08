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
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}

		secret := os.Getenv("JWT_SECRET")
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			writeError(w, http.StatusUnauthorized, "invalid token claims")
			return
		}
		sub, _ := claims["sub"].(string)
		userID, err := strconv.Atoi(sub)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid token claims")
			return
		}
		role, _ := claims["role"].(string)

		ctx := context.WithValue(r.Context(), userIDContextKey, userID)
		ctx = context.WithValue(ctx, roleContextKey, role)
		next(w, r.WithContext(ctx))
	}
}

// requireAdmin is requireAuth plus a role check: the caller must be logged
// in AND have role "admin".
func requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return requireAuth(func(w http.ResponseWriter, r *http.Request) {
		if roleFromContext(r) != "admin" {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next(w, r)
	})
}

func userIDFromContext(r *http.Request) int {
	id, _ := r.Context().Value(userIDContextKey).(int)
	return id
}

func roleFromContext(r *http.Request) string {
	role, _ := r.Context().Value(roleContextKey).(string)
	return role
}
