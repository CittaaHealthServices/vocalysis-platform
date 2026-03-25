import clsx from 'clsx'

export const Select = ({
  label,
  options,
  value,
  onChange,
  error,
  helperText,
  placeholder = 'Select an option',
  disabled = false,
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
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
          'input-base w-full bg-white',
          error && 'border-red-500 focus:ring-red-500',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  )
}

export default Select
