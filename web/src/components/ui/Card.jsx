import clsx from 'clsx'

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div className={clsx('card-base p-6', className)} {...props}>
      {children}
    </div>
  )
}

export const CardHeader = ({ children, className = '' }) => {
  return <div className={clsx('mb-4 pb-4 border-b border-gray-100', className)}>{children}</div>
}

export const CardTitle = ({ children, className = '' }) => {
  return <h3 className={clsx('text-lg font-semibold text-app', className)}>{children}</h3>
}

export const CardContent = ({ children, className = '' }) => {
  return <div className={clsx('', className)}>{children}</div>
}

export const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={clsx('mt-4 pt-4 border-t border-gray-100 flex gap-2 justify-end', className)}>
      {children}
    </div>
  )
}

export default Card
