import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  withCredentials: true, // Enable httpOnly cookie handling
})

let authContextRef = null

export const setAuthContext = (context) => {
  authContextRef = context
}

// Request interceptor: attach access token
api.interceptors.request.use(
  (config) => {
    if (authContextRef?.getAccessToken) {
      const token = authContextRef.getAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Auth endpoints that should NEVER trigger a token refresh retry
// (avoids infinite loop when refresh/verify themselves return 401)
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/verify', '/auth/logout', '/auth/register']
const isAuthEndpoint = (url = '') => AUTH_ENDPOINTS.some(p => url.includes(p))

// Response interceptor: handle 401, attempt refresh, retry
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  async (error) => {
    const originalRequest = error.config

    // Only attempt refresh for non-auth endpoints and only once
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true

      try {
        // Attempt token refresh
        if (authContextRef?.refreshToken) {
          const success = await authContextRef.refreshToken()
          if (success) {
            // Retry original request with new token
            const token = authContextRef.getAccessToken()
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          }
        }
      } catch (err) {
        // Refresh failed, logout
        if (authContextRef?.logout) {
          authContextRef.logout()
        }
        return Promise.reject(err)
      }
    }

    // Normalize error response
    // API returns { success: false, error: { message, code } }
    // OR { success: false, message } — handle both shapes
    const errorData = error.response?.data || {}
    const apiMessage =
      errorData?.error?.message ||   // { error: { message: '...' } }
      errorData?.message ||          // { message: '...' }
      error.message ||               // Axios network-level message
      'An error occurred'
    return Promise.reject({
      success: false,
      error: {
        code: errorData?.error?.code || errorData.code || error.code || 'UNKNOWN_ERROR',
        message: apiMessage,
        status: error.response?.status,
        details: errorData?.error?.details || errorData.details,
      },
    })
  }
)

export default api
