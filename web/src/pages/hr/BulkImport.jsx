import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { Card, Button, Table, LoadingScreen } from '../../components/ui'
import { Upload } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

export const BulkImport = () => {
  const [csvData, setCsvData] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            setCsvData(results.data.filter((row) => row.name)) // Filter empty rows
          },
          error: (error) => {
            toast.error('Error parsing CSV: ' + error.message)
          },
        })
      }
    },
    accept: { 'text/csv': ['.csv'] },
  })

  const handleImport = async () => {
    setImporting(true)
    setProgress(10)
    try {
      // Send all records in one batch request
      const res = await api.post('/employees/bulk-json', { employees: csvData })
      setProgress(100)
      toast.success(`Import completed: ${res.data?.imported || csvData.length} employees added`)
      setCsvData([])
      setProgress(0)
    } catch (error) {
      toast.error('Import failed: ' + (error?.error?.message || error?.message || 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Bulk Import Employees</h1>

      <Card className="p-8">
        <div
          {...getRootProps()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-cittaa-700 transition cursor-pointer"
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-app mb-2">Drop CSV file here or click to select</p>
          <p className="text-sm text-gray-600">
            Required columns: name, employeeId, email, department, joiningDate
          </p>
        </div>

        {csvData.length > 0 && (
          <>
            <div className="mt-6">
              <h3 className="font-semibold text-app mb-4">Preview ({csvData.length} records)</h3>
              <div className="max-h-96 overflow-y-auto">
                <Table
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'employeeId', label: 'ID' },
                    { key: 'email', label: 'Email' },
                    { key: 'department', label: 'Department' },
                  ]}
                  data={csvData}
                />
              </div>
            </div>

            {importing && (
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-cittaa-700 h-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Importing... {Math.round(progress)}%
                </p>
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button
                variant="primary"
                onClick={handleImport}
                loading={importing}
              >
                Confirm Import
              </Button>
              <Button variant="secondary" onClick={() => setCsvData([])}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default BulkImport
