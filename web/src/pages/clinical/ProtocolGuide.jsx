import { Card, CardTitle } from '../../components/ui'
import { BookOpen } from 'lucide-react'

export const ProtocolGuide = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Clinical Protocol Guide</h1>

      <div className="grid grid-cols-1 gap-6">
        <Card className="p-6">
          <CardTitle className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-cittaa-700" />
            Assessment Standards
          </CardTitle>
          <p className="text-gray-700">
            Follow these protocols when conducting patient assessments through the Vocalysis Platform.
          </p>
        </Card>

        <Card className="p-6">
          <CardTitle className="mb-4">Pre-Assessment Checklist</CardTitle>
          <ul className="space-y-2 text-gray-700">
            <li>✓ Ensure patient is in a quiet environment</li>
            <li>✓ Verify audio equipment is functioning properly</li>
            <li>✓ Confirm informed consent obtained</li>
            <li>✓ Review patient's assessment history</li>
          </ul>
        </Card>

        <Card className="p-6">
          <CardTitle className="mb-4">During Assessment</CardTitle>
          <p className="text-gray-700 mb-4">
            Maintain clinical professionalism and follow the prompts as specified. Do not deviate from the approved prompt sets.
          </p>
        </Card>

        <Card className="p-6">
          <CardTitle className="mb-4">Post-Assessment</CardTitle>
          <ul className="space-y-2 text-gray-700">
            <li>✓ Review VocaCore™ results for clinical validity</li>
            <li>✓ Document clinician observations</li>
            <li>✓ Enter validated scale scores if collected</li>
            <li>✓ Generate clinical report</li>
            <li>✓ Schedule follow-up if indicated</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

export default ProtocolGuide
