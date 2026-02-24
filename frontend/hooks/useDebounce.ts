import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const [isReady, setIsReady] = useState(true)

  const debouncedCallback = (...args: Parameters<T>) => {
    if (!isReady) return

    setIsReady(false)
    callback(...args)

    setTimeout(() => {
      setIsReady(true)
    }, delay)
  }

  return debouncedCallback as T
}
