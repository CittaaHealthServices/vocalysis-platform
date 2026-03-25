import clsx from 'clsx'

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-cittaa-700 text-white hover:bg-cittaa-800 active:bg-cittaa-900',
    secondary: 'bg-gray-100 text-app hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-app hover:bg-gray-100',
    outline: 'border border-gray-200 text-app hover:bg-gray-50',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200',
        variants[variant],
        sizes[size],
        disabled || loading ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="inline-block w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  )
}

export default Button
