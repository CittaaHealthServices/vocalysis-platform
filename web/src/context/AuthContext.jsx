import React, { createContext, useState, useCallback, useEffect, useRef } from 'react'
import api, { setAuthContext } from '../services/api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(null)
  const tokenRefreshTimeoutRef = useRef(null)

  const normalizeAuthResponse = useCallback((response) => {
    if (!response) {
      return null
    }

    if (response.success && response.data) {
      return response.data
    }

    if (response.accessToken && response.user) {
      return {
        accessToken: response.accessToken,
        user: response.user,
        expiresIn: response.expiresIn ?? 15 * 60,
      }
    }

    return null
  }, [])

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
      const authData = normalizeAuthResponse(response)
      if (authData) {
        setAccessToken(authData.accessToken)
        setUser(authData.user)
        setIsAuthenticated(true)
        scheduleTokenRefresh(authData.expiresIn)
        return true
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      logout()
      return false
    }
  }, [normalizeAuthResponse, scheduleTokenRefresh])

  // Login
  const login = useCallback(async (email, password, totpCode = null) => {
    try {
      setIsLoading(true)
      const payload = { email, password }
      if (totpCode) {
        payload.totpCode = totpCode
      }

      const response = await api.post('/auth/login', payload)
      const authData = normalizeAuthResponse(response)
      if (authData) {
        const { accessToken: token, user: userData, expiresIn } = authData
        setAccessToken(token)
        setUser(userData)
        setIsAuthenticated(true)
        scheduleTokenRefresh(expiresIn)
        return { success: true, requiresMfa: false }
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
  }, [normalizeAuthResponse, scheduleTokenRefresh])

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
        const authData = normalizeAuthResponse(response)
        if (authData) {
          setAccessToken(authData.accessToken)
          setUser(authData.user)
          setIsAuthenticated(true)
          scheduleTokenRefresh(authData.expiresIn)
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
  }, [normalizeAuthResponse, scheduleTokenRefresh])

  // Set up auth context reference for api interceptors
  useEffect(() => {
    setAuthContext({
      getAccessToken,
      refreshToken,
      logout,
    })
  }, [getAccessToken, refreshToken, logout])

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
    getAccessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
