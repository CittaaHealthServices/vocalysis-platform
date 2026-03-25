import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

export const useApi = (queryKey, queryFn, options = {}) => {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  })
}

export const useApiMutation = (mutationFn, options = {}) => {
  const defaultOptions = {
    onSuccess: (data) => {
      if (options.successMessage) {
        toast.success(options.successMessage)
      }
      options.onSuccess?.(data)
    },
    onError: (error) => {
      const message = error?.error?.message || 'An error occurred'
      toast.error(message)
      options.onError?.(error)
    },
  }

  return useMutation({
    mutationFn,
    ...defaultOptions,
    ...options,
  })
}
