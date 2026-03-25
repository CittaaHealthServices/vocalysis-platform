import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { Copy, Trash2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const APIKeys = () => {
  const { data: keys, isLoading } = useApi(['api-keys', 'cittaa'], () => api.get('/cittaa-admin/api-keys'))

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">API Keys Management</h1>
        <Button variant="primary">+ Generate New Key</Button>
      </div>

      {keys?.data?.map((key) => (
        <Card key={key.id} className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-app">{key.name}</h3>
              <p className="text-sm text-gray-600">Tenant: {key.tenantName}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
              Active
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-3 font-mono">{key.keyPreview}...</p>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => handleCopy(key.key)}>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
            <Button variant="danger" size="sm">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default APIKeys
