/**
 * Register page — not used in Vocalysis (accounts are admin-created).
 * Redirects to login.
 */
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export const Register = () => {
  const navigate = useNavigate()
  useEffect(() => { navigate('/login', { replace: true }) }, [navigate])
  return null
}

export default Register
