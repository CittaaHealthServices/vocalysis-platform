import { useState } from 'react'
import { Card, Button, Modal } from '../../components/ui'
import { BookOpen, Video, FileText, Users, X } from 'lucide-react'

export const Resources = () => {
  const [activeResource, setActiveResource] = useState(null)

  const resources = [
    {
      icon: BookOpen,
      title: 'Stress Management Guide',
      description: 'Learn evidence-based techniques for managing stress',
      type: 'article',
      content: 'Stress is a normal part of life, but chronic stress can impact your health. Key techniques include deep breathing, progressive muscle relaxation, time management, and regular physical activity. Consider speaking with a professional if stress feels overwhelming.',
    },
    {
      icon: Video,
      title: 'Meditation & Mindfulness',
      description: 'Guided meditation and mindfulness exercises',
      type: 'video',
      content: 'Mindfulness practice involves paying attention to the present moment without judgment. Start with 5 minutes daily: sit comfortably, focus on your breath, and gently redirect your attention when your mind wanders. Apps like Headspace and Calm can help you get started.',
    },
    {
      icon: FileText,
      title: 'Sleep Hygiene Tips',
      description: 'Improve your sleep quality with our practical tips',
      type: 'article',
      content: 'Good sleep hygiene: keep a consistent sleep schedule, make your bedroom cool and dark, avoid screens 1 hour before bed, limit caffeine after 2pm, and try a relaxing bedtime routine. If sleep issues persist, speak with your doctor.',
    },
    {
      icon: Users,
      title: 'Support Groups',
      description: 'Connect with peers and share experiences',
      type: 'community',
      content: 'Our peer support groups provide a safe, confidential space to share experiences and learn from others. Groups meet virtually every week. Contact your HR team or clinician to join. All sessions are facilitated by licensed professionals.',
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-app">Wellness Resources</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {resources.map((resource) => {
          const Icon = resource.icon
          return (
            <Card key={resource.title} className="p-6">
              <div className="flex items-start gap-4">
                <Icon className="w-8 h-8 text-cittaa-700 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-app mb-1">{resource.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{resource.description}</p>
                  <Button variant="secondary" size="sm" onClick={() => setActiveResource(resource)}>
                    Access Resource
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        isOpen={!!activeResource}
        onClose={() => setActiveResource(null)}
        title={activeResource?.title}
        size="md"
      >
        {activeResource && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 bg-cittaa-100 text-cittaa-700 rounded-full capitalize">
                {activeResource.type}
              </span>
            </div>
            <p className="text-gray-700 leading-relaxed">{activeResource.content}</p>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Need more support? Reach out to your HR team or request a consultation with a clinician.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Resources
