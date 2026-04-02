import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import api from '../../services/api'
import toast from 'react-hot-toast'

const GoogleCallback = () => {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const { login }    = useAuth()

  useEffect(() => {
    const code  = params.get('code')
    const error = params.get('error')

    if (error) {
      toast.error('Google sign-in was cancelled')
      navigate('/login')
      return
    }

    if (!code) {
      navigate('/login')
      return
    }

    api.post('/auth/google/callback', { code })
      .then((res) => {
        const { token, user } = res.data || res
        if (token && user) {
          login(token, user)
        } else {
          throw new Error('Invalid response')
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Google sign-in failed')
        navigate('/login')
      })
  }, []) // eslint-disable-line

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Signing you in with Google…</p>
      </div>
    </div>
  )
}

export default GoogleCallback
