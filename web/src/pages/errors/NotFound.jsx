import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { AlertCircle } from 'lucide-react'

export const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-app mb-2">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </div>
  )
}

export default NotFound
