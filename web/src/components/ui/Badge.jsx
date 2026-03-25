import clsx from 'clsx'

export const Badge = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const variants = {
    primary: 'bg-cittaa-100 text-cittaa-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    minimal: 'bg-green-100 text-green-700',
    mild: 'bg-yellow-100 text-yellow-700',
    moderate: 'bg-orange-100 text-orange-700',
    severe: 'bg-red-100 text-red-700',
    thriving: 'bg-green-100 text-green-700',
    'doing-well': 'bg-blue-100 text-blue-700',
    'needs-attention': 'bg-yellow-100 text-yellow-700',
    'support-needed': 'bg-red-100 text-red-700',
    online: 'bg-blue-100 text-blue-700',
    offline: 'bg-green-100 text-green-700',
    scheduled: 'bg-cittaa-100 text-cittaa-700',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  const sizes = {
    sm: 'px-2 py-1 text-xs font-medium rounded',
    md: 'px-3 py-1.5 text-sm font-medium rounded-md',
    lg: 'px-4 py-2 text-base font-medium rounded-lg',
  }

  return (
    <span className={clsx('inline-flex items-center', variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  )
}

export default Badge
