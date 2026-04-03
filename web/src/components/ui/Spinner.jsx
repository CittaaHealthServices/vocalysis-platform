import clsx from 'clsx'

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  return (
    <div className={clsx('border-4 border-cittaa-200 border-t-cittaa-700 rounded-full animate-spin', sizes[size], className)} />
  )
}

export default Spinner
