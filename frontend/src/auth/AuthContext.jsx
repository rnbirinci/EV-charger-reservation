import { createContext, useContext, useState, useCallback } from 'react'
import { api, tokens, decodeToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Restore the session from a stored access token on first load. The token is
  // only trusted for choosing what to render; the backend re-checks everything.
  const [user, setUser] = useState(() => decodeToken(tokens.access))

  const login = useCallback(async (licensePlate, pin) => {
    const claims = await api.login(licensePlate, pin)
    setUser(claims)
    return claims
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const value = {
    user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
