import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In - CloudIt',
  description: 'Sign in to your CloudIt account',
}

export default function LoginPage() {
  return <LoginForm />
}
