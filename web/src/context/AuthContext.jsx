import React, { createContext, useState, useCallback, useEffect, useRef } from 'react'
import api, { setAuthContext } from '../services/api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(null)
  const tokenRefreshTimeoutRef = useRef(null)

  // Get access token
  const getAccessToken = useCallback(() => {
    return accessToken
  }, [accessToken])

  // Schedule token refresh 5 minutes before expiry
  const scheduleTokenRefresh = useCallback((expiresIn) => {
    // Clear existing timeout
    if (tokenRefreshTimeoutRef.current) {
      clearTimeout(tokenRefreshTimeoutRef.current)
    }

    // Refresh 5 minutes before expiry (or after 10 minutes if expiresIn is long)
    const refreshTime = Math.min(expiresIn - 5 * 60, 10 * 60) * 1000
    if (refreshTime > 0) {
      tokenRefreshTimeoutRef.current = setTimeout(() => {
        refreshToken()
      }, refreshTime)
    }
  }, [])

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      const response = await api.post('/auth/refresh')
      if (response.success) {
        setAccessToken(response.data.accessToken)
        setUser(response.data.user)
        scheduleTokenRefresh(response.data.expiresIn)
        return true
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }, [scheduleTokenRefresh])

  // Login
  const login = useCallback(async (email, password, totpCode = null) => {
    try {
      setIsLoading(true)
      const payload = { email, password }
      if (totpCode) {
        payload.totpCode = totpCode
      }

      const response = await api.post('/auth/login', payload)
      if (response.success) {
        const { accessToken: token, user: userData, expiresIn } = response.data
        setAccessToken(token)
        setUser(userData)
        setIsAuthenticated(true)
        scheduleTokenRefresh(expiresIn)
        return { success: true, requiresMfa: false, user: userData }
      }
    } catch (error) {
      const errorMessage = error.error?.message || 'Login failed'
      // Check if MFA is required
      if (error.error?.code === 'MFA_REQUIRED') {
        return { success: false, requiresMfa: true, error: errorMessage }
      }
      return { success: false, requiresMfa: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [scheduleTokenRefresh])

  // Logout
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      setAccessToken(null)
      setUser(null)
      setIsAuthenticated(false)
      if (tokenRefreshTimeoutRef.current) {
        clearTimeout(tokenRefreshTimeoutRef.current)
      }
    }
  }, [])

  // Check if token is still valid on mount (from cookies)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.post('/auth/verify')
        if (response.success) {
          setAccessToken(response.data.accessToken)
          setUser(response.data.user)
          setIsAuthenticated(true)
          scheduleTokenRefresh(response.data.expiresIn)
        } else {
          setIsAuthenticated(false)
        }
      } catch (error) {
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [scheduleTokenRefresh])

  // Set up auth context reference for api interceptors
  useEffect(() => {
    setAuthContext({
      getAccessToken,
      refreshToken,
      logout,
    })
  }, [getAccessToken, refreshToken, logout])

  // loginWithToken — used by GoogleCallback after OAuth redirect
  const loginWithToken = useCallback((token, dest = '/') => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const userData = {
        _id:       payload.sub || payload.userId,
        userId:    payload.userId,
        email:     payload.email,
        role:      payload.role,
        tenantId:  payload.tenantId,
        firstName: payload.firstName,
        lastName:  payload.lastName,
      }
      setAccessToken(token)
      setUser(userData)
      setIsAuthenticated(true)
      const expiresIn = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 900
      scheduleTokenRefresh(expiresIn)
      // Hard navigate so the router picks up fresh auth state
      window.location.replace(dest)
    } catch (err) {
      console.error('loginWithToken: failed to decode token', err)
      window.location.replace('/login?error=invalid_token')
    }
  }, [scheduleTokenRefresh])

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    loginWithToken,
    logout,
    refreshToken,
    getAccessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
