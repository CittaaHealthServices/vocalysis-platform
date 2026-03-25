import clsx from 'clsx'

export const Input = ({
  label,
  error,
  helperText,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-app mb-2">
          {label}
          {props.required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        )}
        <input
          className={clsx(
            'input-base w-full',
            LeftIcon && 'pl-10',
            RightIcon && 'pr-10',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        {RightIcon && (
          <RightIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  )
}

export default Input
