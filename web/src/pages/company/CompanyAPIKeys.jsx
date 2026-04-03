import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { Copy, Trash2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const CompanyAPIKeys = () => {
  const { data: keys, isLoading } = useApi(['api-keys', 'company'], () => api.get('/company/api-keys'))

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this API key?')) {
      try {
        await api.delete(`/company/api-keys/${id}`)
        toast.success('API key deleted')
      } catch (error) {
        toast.error('Failed to delete API key')
      }
    }
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">API Keys</h1>
        <Button variant="primary">+ Generate New Key</Button>
      </div>

      {keys?.data?.map((key) => (
        <Card key={key.id} className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-app">{key.name}</h3>
              <p className="text-sm text-gray-600">Created {new Date(key.createdAt).toLocaleDateString()}</p>
            </div>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
              {key.status}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-4 font-mono text-sm break-all">
            {key.keyPreview}...
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(key.key)}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(key.id)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default CompanyAPIKeys
