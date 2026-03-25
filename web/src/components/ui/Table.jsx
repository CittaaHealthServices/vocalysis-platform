import clsx from 'clsx'
import { Checkbox } from './Checkbox'

export const Table = ({
  columns,
  data,
  onRowClick,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  loading = false,
}) => {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {selectable && (
              <th className="px-4 py-3 text-left">
                <Checkbox
                  checked={selectedRows.length === data.length && data.length > 0}
                  onChange={(checked) => {
                    onSelectionChange(checked ? data.map((_, i) => i) : [])
                  }}
                />
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} className={clsx('px-4 py-3 text-left font-semibold text-gray-700', col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-cittaa-200 border-t-cittaa-700 rounded-full animate-spin" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => onRowClick?.(row)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedRows.includes(rowIdx)}
                      onChange={(checked) => {
                        if (checked) {
                          onSelectionChange([...selectedRows, rowIdx])
                        } else {
                          onSelectionChange(selectedRows.filter((i) => i !== rowIdx))
                        }
                      }}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={clsx('px-4 py-3', col.className)}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
