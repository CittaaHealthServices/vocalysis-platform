import { useApi } from '../../hooks/useApi'
import { Card, Button, LoadingScreen } from '../../components/ui'
import { Copy, Trash2, Plus } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const CompanyAPIKeys = () => {
  const { data: keys, isLoading, refetch } = useApi(['api-keys', 'company'], () => api.get('/company/api-keys'))

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  const handleGenerate = async () => {
    try {
      await api.post('/company/api-keys')
      toast.success('New API key generated')
      refetch?.()
    } catch {
      toast.error('Failed to generate API key')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this API key? This cannot be undone.')) {
      try {
        await api.delete(`/company/api-keys/${id}`)
        toast.success('API key deleted')
        refetch?.()
      } catch {
        toast.error('Failed to delete API key')
      }
    }
  }

  if (isLoading) return <LoadingScreen />

  const list = keys?.data || keys?.keys || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">API Keys</h1>
        <Button variant="primary" onClick={handleGenerate} className="gap-2 flex items-center">
          <Plus className="w-4 h-4" /> Generate New Key
        </Button>
      </div>

      {list.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          No API keys yet. Generate one to get started.
        </Card>
      )}

      {list.map((key) => (
        <Card key={key._id || key.id} className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-app">{key.name || 'API Key'}</h3>
              <p className="text-sm text-gray-600">Created {new Date(key.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded font-medium ${key.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {key.isActive !== false ? 'Active' : 'Revoked'}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-4 font-mono text-sm break-all text-gray-700">
            {key.keyHashPrefix || key.keyPreview || '••••••••'}...
          </div>

          <div className="flex gap-2">
            {key.key && (
              <Button variant="secondary" size="sm" onClick={() => handleCopy(key.key)} className="gap-2">
                <Copy className="w-4 h-4" /> Copy
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => handleDelete(key._id || key.id)} className="gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default CompanyAPIKeys
