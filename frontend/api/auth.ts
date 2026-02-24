import { createApiRequest } from '@/utils/api'
import type { User, LoginInput, SignUpInput } from '@/types'

interface AuthResponse {
  token: string
}

export function clearTokenCookie() {
  if (typeof window !== 'undefined') {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax'
  }
}

export async function signIn(input: LoginInput): Promise<User> {
  try {
    await createApiRequest<AuthResponse>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    // Session cookie is set by backend (httpOnly).
    const userData = await getCurrentUser()
    return userData
  } catch (error) {
    console.error('Sign in error:', error)
    throw error
  }
}

export async function signUp(input: SignUpInput): Promise<User> {
  try {
    await createApiRequest<AuthResponse>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    // Session cookie is set by backend (httpOnly).
    const userData = await getCurrentUser()
    return userData
  } catch (error) {
    console.error('Sign up error:', error)
    throw error
  }
}

export async function getCurrentUser(): Promise<User> {
  try {
    const user = await createApiRequest<User>('/auth/me', {
      method: 'GET',
    })
    return user
  } catch (error) {
    console.error('Get current user error:', error)
    throw error
  }
}

export async function logout(): Promise<void> {
  try {
    await createApiRequest<void>('/auth/logout', {
      method: 'POST',
    })
  } finally {
    // Clear any legacy client-set cookie even if server request fails.
    clearTokenCookie()
  }
}

export async function verifyAuth(): Promise<boolean> {
  try {
    await getCurrentUser()
    return true
  } catch {
    return false
  }
}
