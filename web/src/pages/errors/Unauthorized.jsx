import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { Lock } from 'lucide-react'

export const Unauthorized = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="text-center">
        <Lock className="w-16 h-16 text-gray-400 mx-auto mb-6" />
        <h1 className="text-6xl font-bold text-app mb-2">403</h1>
        <p className="text-xl text-gray-600 mb-8">Unauthorized</p>
        <p className="text-gray-600 mb-8">
          You don't have permission to access this resource.
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </div>
  )
}

export default Unauthorized
