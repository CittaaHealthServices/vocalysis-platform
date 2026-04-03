/**
 * useApi — thin wrapper around @tanstack/react-query v5's useQuery / useMutation.
 * Provides a consistent interface used across the entire app.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Data-fetching hook.
 * @param {Array}    queryKey  - React Query cache key (array)
 * @param {Function} queryFn   - Async function that returns data
 * @param {Object}   [options] - Extra useQuery options (enabled, staleTime, etc.)
 */
export const useApi = (queryKey, queryFn, options = {}) => {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  })
}

/**
 * Mutation hook for POST / PATCH / DELETE operations.
 * @param {Function} mutationFn - Async function that performs the mutation
 * @param {Object}   [options]  - Extra useMutation options (onSuccess, onError, etc.)
 */
export const useApiMutation = (mutationFn, options = {}) => {
  return useMutation({
    mutationFn,
    ...options,
  })
}

/**
 * Convenience hook to manually invalidate query cache entries.
 * Usage: const invalidate = useInvalidate(); invalidate(['employees'])
 */
export const useInvalidate = () => {
  const queryClient = useQueryClient()
  return (queryKey) => queryClient.invalidateQueries({ queryKey })
}

export default useApi
