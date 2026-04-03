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

// Response interceptor: handle 401, attempt refresh, retry
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  async (error) => {
    const originalRequest = error.config
    const requestUrl = originalRequest?.url || ''
    const isAuthRecoveryRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/verify') ||
      requestUrl.includes('/auth/logout')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRecoveryRequest) {
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
    const errorData = error.response?.data || {}
    return Promise.reject({
      success: false,
      error: {
        code: errorData.code || error.code || 'UNKNOWN_ERROR',
        message: errorData.message || error.message || 'An error occurred',
        status: error.response?.status,
        details: errorData.details,
      },
    })
  }
)

export default api
