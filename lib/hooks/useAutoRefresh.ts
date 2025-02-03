import { useEffect, useRef, useState } from 'react'

interface UseAutoRefreshOptions {
  refreshInterval: number
  onRefresh: () => Promise<void>
  enabled?: boolean
}

export function useAutoRefresh({ refreshInterval, onRefresh, enabled = true }: UseAutoRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const timeoutRef = useRef<NodeJS.Timeout>()

  const refresh = async () => {
    if (isRefreshing || !enabled) return

    try {
      setIsRefreshing(true)
      await onRefresh()
      setLastRefreshed(new Date())
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // If disabled or no interval, don't set up refresh
    if (!enabled || !refreshInterval) return

    // Set up the refresh interval
    const setupRefresh = () => {
      timeoutRef.current = setTimeout(async () => {
        await refresh()
        // Set up the next refresh after this one completes
        setupRefresh()
      }, refreshInterval)
    }

    // Start the refresh cycle
    setupRefresh()

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [refreshInterval, enabled])

  return {
    isRefreshing,
    lastRefreshed,
    refresh
  }
} 