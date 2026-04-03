/**
 * CEO Dashboard — Cittaa platform overview for CEO/Super Admin.
 * Redirects to the main cittaa-admin overview.
 */
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export const CEODashboard = () => {
  const navigate = useNavigate()
  useEffect(() => { navigate('/cittaa/overview', { replace: true }) }, [navigate])
  return null
}

export default CEODashboard
