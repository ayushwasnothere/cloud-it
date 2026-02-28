'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { toast } from 'sonner'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email')
      return
    }

    try {
      await login({ email, password })
      toast.success('Welcome back!')
    } catch (err) {
      console.error('Login error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      toast.error(errorMessage)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4">
      <Card className="w-full max-w-md bg-app-surface border-app-border">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-app-text mb-2 text-center">
            Cloud IDE
          </h1>
          <p className="text-sm text-app-muted text-center mb-8">
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-app-muted mb-2">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                className="bg-app-surface-2 border-app-border text-app-text placeholder-app-subtle"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-app-muted mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="bg-app-surface-2 border-app-border text-app-text placeholder-app-subtle"
              />
            </div>

            {error && (
              <div className="p-3 bg-app-danger-soft border border-app-danger/60 rounded text-sm text-app-danger">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-app-primary hover:bg-app-primary-hover text-white"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <p className="text-sm text-app-muted text-center mt-6">
            Don't have an account?{' '}
            <Link href="/signup" className="text-app-primary hover:text-app-primary-hover">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
