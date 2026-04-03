import { Card, CardTitle, Button } from '../../components/ui'
import { BookOpen, Video, FileText, Users } from 'lucide-react'

export const Resources = () => {
  const resources = [
    {
      icon: BookOpen,
      title: 'Stress Management Guide',
      description: 'Learn evidence-based techniques for managing stress',
      type: 'article',
    },
    {
      icon: Video,
      title: 'Meditation & Mindfulness',
      description: 'Guided meditation and mindfulness exercises',
      type: 'video',
    },
    {
      icon: FileText,
      title: 'Sleep Hygiene Tips',
      description: 'Improve your sleep quality with our practical tips',
      type: 'article',
    },
    {
      icon: Users,
      title: 'Support Groups',
      description: 'Connect with peers and share experiences',
      type: 'community',
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
                  <Button variant="secondary" size="sm">
                    Access Resource
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default Resources
