import clsx from 'clsx'

export const Checkbox = ({ checked = false, onChange, label, disabled = false, ...props }) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={clsx(
          'w-4 h-4 rounded border-gray-300 text-cittaa-700 focus:ring-cittaa-600 focus:ring-offset-0',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        {...props}
      />
      {label && <span className="text-sm text-app">{label}</span>}
    </label>
  )
}

export default Checkbox
