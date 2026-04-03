/**
 * SessionForms — Clinical session intake and assessment forms.
 * Coming soon.
 */
import { FileText } from 'lucide-react'

export const SessionForms = () => (
  <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
      <FileText className="w-7 h-7 text-violet-500" />
    </div>
    <div>
      <h2 className="text-lg font-semibold text-gray-800">Session Forms</h2>
      <p className="text-sm text-gray-500 mt-1">Clinical session forms are coming soon.</p>
    </div>
  </div>
)

export default SessionForms
