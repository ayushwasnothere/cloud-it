import { Metadata } from 'next'
import { SignUpForm } from '@/components/auth/SignUpForm'

export const metadata: Metadata = {
  title: 'Create Account - CloudIt',
  description: 'Create a new CloudIt account',
}

export default function SignUpPage() {
  return <SignUpForm />
}
