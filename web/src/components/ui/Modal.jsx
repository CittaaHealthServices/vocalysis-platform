import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeButton = true,
  className = '',
  onBackdropClick = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  const handleBackdropClick = () => {
    if (onBackdropClick) {
      onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={handleBackdropClick}
      />
      <div className={clsx('relative bg-white rounded-xl shadow-lg', sizes[size], 'max-h-[90vh] overflow-y-auto', className)}>
        {(title || closeButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            {title && <h2 className="text-xl font-semibold text-app">{title}</h2>}
            {closeButton && (
              <button
                onClick={onClose}
                className="ml-auto text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
