package handlers

import (
	"sync"
	"time"
)

// loginLimiter throttles login attempts per key (license plate) to slow down
// brute-forcing of the 4-digit PIN. After maxFailures failed attempts a key is
// locked for lockout; a successful login clears its record.
type loginLimiter struct {
	mu          sync.Mutex
	attempts    map[string]*attemptState
	maxFailures int
	lockout     time.Duration
}

type attemptState struct {
	failures    int
	lockedUntil time.Time
}

func newLoginLimiter() *loginLimiter {
	return &loginLimiter{
		attempts:    make(map[string]*attemptState),
		maxFailures: 5,
		lockout:     15 * time.Minute,
	}
}

// allowed reports whether key may attempt a login right now.
func (l *loginLimiter) allowed(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	st := l.attempts[key]
	if st == nil {
		return true
	}
	if !st.lockedUntil.IsZero() && time.Now().Before(st.lockedUntil) {
		return false
	}
	if !st.lockedUntil.IsZero() {
		// lock expired — clear the slate
		delete(l.attempts, key)
	}
	return true
}

func (l *loginLimiter) recordFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	st := l.attempts[key]
	if st == nil {
		st = &attemptState{}
		l.attempts[key] = st
	}
	st.failures++
	if st.failures >= l.maxFailures {
		st.lockedUntil = time.Now().Add(l.lockout)
	}
}

func (l *loginLimiter) reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}
