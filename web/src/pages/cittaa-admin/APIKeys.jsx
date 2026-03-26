import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { Card, Button, Input, LoadingScreen, Modal } from '../../components/ui'
import { Copy, Trash2, Eye, EyeOff, Key } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const APIKeys = () => {
  const [genModalOpen, setGenModalOpen]   = useState(false)
  const [newKeyName, setNewKeyName]       = useState('')
  const [generating, setGenerating]       = useState(false)
  const [newKeyResult, setNewKeyResult]   = useState(null)
  const [visibleKeys, setVisibleKeys]     = useState({})

  const { data: keys, isLoading, refetch } = useApi(['api-keys', 'cittaa'], () => api.get('/cittaa-admin/api-keys'))

  const handleCopy = (val) => {
    navigator.clipboard.writeText(val)
    toast.success('Copied to clipboard')
  }

  const handleGenerate = async () => {
    if (!newKeyName.trim()) { toast.error('Key name is required'); return }
    setGenerating(true)
    try {
      const res = await api.post('/cittaa-admin/api-keys', { name: newKeyName.trim() })
      setNewKeyResult(res.key || res.data?.key || res)
      setNewKeyName('')
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to generate key')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete API key "${name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/cittaa-admin/api-keys/${id}`)
      toast.success('API key deleted')
      refetch?.()
    } catch (err) {
      toast.error(err?.error?.message || 'Failed to delete key')
    }
  }

  const toggleVisible = (id) => setVisibleKeys(v => ({ ...v, [id]: !v[id] }))

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-app">API Keys Management</h1>
        <Button variant="primary" onClick={() => { setNewKeyResult(null); setGenModalOpen(true) }}>
          + Generate New Key
        </Button>
      </div>

      {(!keys?.data || keys.data.length === 0) && (
        <Card className="p-12 text-center">
          <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No API keys yet. Generate your first key above.</p>
        </Card>
      )}

      {keys?.data?.map((key) => (
        <Card key={key.id} className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-app">{key.name}</h3>
              {key.tenantName && <p className="text-sm text-gray-500">Tenant: {key.tenantName}</p>}
              <p className="text-xs text-gray-400 mt-0.5">
                Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '—'}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">Active</span>
          </div>

          <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <code className="text-sm text-gray-700 flex-1 truncate font-mono">
              {visibleKeys[key.id] ? (key.key || key.keyValue || key.keyPreview + '...') : (key.keyPreview ? key.keyPreview + '••••••••••••' : '••••••••••••••••••••••••')}
            </code>
            <button onClick={() => toggleVisible(key.id)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
              {visibleKeys[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => handleCopy(key.key || key.keyPreview)}>
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleDelete(key.id, key.name)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        </Card>
      ))}

      {/* Generate Key Modal */}
      <Modal
        isOpen={genModalOpen}
        onClose={() => { setGenModalOpen(false); setNewKeyResult(null) }}
        title="Generate New API Key"
        size="md"
      >
        {newKeyResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
              <Key className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-700">Key generated — copy it now, it won't be shown again</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <code className="text-sm text-gray-800 flex-1 break-all font-mono">
                {typeof newKeyResult === 'string' ? newKeyResult : newKeyResult?.key || JSON.stringify(newKeyResult)}
              </code>
              <button
                onClick={() => handleCopy(typeof newKeyResult === 'string' ? newKeyResult : newKeyResult?.key)}
                className="text-gray-400 hover:text-violet-600 flex-shrink-0 ml-2"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <Button variant="primary" className="w-full" onClick={() => { setGenModalOpen(false); setNewKeyResult(null) }}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Give this key a descriptive name so you remember what it's for.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
              <Input
                placeholder="e.g. Production Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="primary" className="flex-1" onClick={handleGenerate} loading={generating}>
                Generate Key
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setGenModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default APIKeys
