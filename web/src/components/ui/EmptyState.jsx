import { Button } from './Button'

export const EmptyState = ({ icon: Icon, title, description, action, actionLabel }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && <Icon className="w-16 h-16 text-gray-300 mb-4" />}
      <h3 className="text-lg font-semibold text-app mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md">{description}</p>
      {action && <Button onClick={action}>{actionLabel}</Button>}
    </div>
  )
}

export default EmptyState
