import { useEffect, useCallback } from 'react'
import { useAuthStore } from '@/state/authStore'
import * as authApi from '@/api/auth'
import { useRouter } from 'next/navigation'
import type { LoginInput, SignUpInput } from '@/types'

export function useAuth() {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    hasInitialized,
    isLoading,
    error,
    setUser,
    setAuthenticated,
    setLoading,
    beginAuthCheck,
    setError,
    logout: storeLogout,
  } = useAuthStore()

  // Check if user is authenticated on mount (only once)
  useEffect(() => {
    // Avoid re-running auth checks from nested consumers once auth is known.
    if (isAuthenticated || user || hasInitialized) {
      return
    }

    if (!beginAuthCheck()) {
      return
    }

    const checkAuth = async () => {
      setLoading(true)
      try {
        const user = await authApi.getCurrentUser()
        console.log('Auth check successful:', user)
        setUser(user)
        setAuthenticated(true)
      } catch (error) {
        console.error('Auth check failed:', error)
        setAuthenticated(false)
        setError(null)
      } finally {
        // Store updates are safe even if this component unmounts.
        setLoading(false)
      }
    }

    checkAuth()
  }, [
    isAuthenticated,
    user,
    hasInitialized,
    beginAuthCheck,
    setLoading,
    setUser,
    setAuthenticated,
    setError,
  ])

  const login = useCallback(
    async (input: LoginInput) => {
      setLoading(true)
      setError(null)
      try {
        console.log('Logging in...')
        const user = await authApi.signIn(input)
        console.log('Login successful, user:', user)
        setUser(user)
        setAuthenticated(true)
        setLoading(false)
        // Push after state is updated
        router.push('/dashboard')
      } catch (err) {
        console.error('Login failed:', err)
        const message =
          err instanceof Error ? err.message : 'Failed to sign in'
        setError(message)
        setLoading(false)
        throw err
      }
    },
    [setUser, setAuthenticated, setLoading, setError, router]
  )

  const signup = useCallback(
    async (input: SignUpInput) => {
      setLoading(true)
      setError(null)
      try {
        console.log('Signing up...')
        const user = await authApi.signUp(input)
        console.log('Signup successful, user:', user)
        setUser(user)
        setAuthenticated(true)
        setLoading(false)
        // Push after state is updated
        router.push('/dashboard')
      } catch (err) {
        console.error('Signup failed:', err)
        const message =
          err instanceof Error ? err.message : 'Failed to sign up'
        setError(message)
        setLoading(false)
        throw err
      }
    },
    [setUser, setAuthenticated, setLoading, setError, router]
  )

  const logout = useCallback(async () => {
    setLoading(true)
    try {
      await authApi.logout()
    } catch {
      // Continue logout even if API call fails
      authApi.clearTokenCookie()
    } finally {
      storeLogout()
      router.push('/login')
      setLoading(false)
    }
  }, [storeLogout, router, setLoading])

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    logout,
  }
}
