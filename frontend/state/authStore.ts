import { create } from 'zustand'
import type { User } from '@/types'

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hasInitialized: boolean
  error: string | null

  setUser: (user: User | null) => void
  setAuthenticated: (authenticated: boolean) => void
  setLoading: (loading: boolean) => void
  beginAuthCheck: () => boolean
  setError: (error: string | null) => void
  logout: () => void
  reset: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with true to prevent redirect before auth check
  hasInitialized: false,
  error: null,

  setUser: (user) => set({ user }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  setLoading: (loading) => set({ isLoading: loading }),
  beginAuthCheck: () => {
    if (get().hasInitialized) {
      return false
    }
    set({ hasInitialized: true })
    return true
  },
  setError: (error) => set({ error }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    }),

  reset: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasInitialized: false,
      error: null,
    }),
}))
