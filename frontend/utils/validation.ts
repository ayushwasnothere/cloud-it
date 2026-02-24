export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function validateProjectName(name: string): {
  isValid: boolean
  error?: string
} {
  if (!name.trim()) {
    return { isValid: false, error: 'Project name is required' }
  }

  if (name.length < 3) {
    return { isValid: false, error: 'Project name must be at least 3 characters' }
  }

  if (name.length > 50) {
    return { isValid: false, error: 'Project name must be less than 50 characters' }
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      isValid: false,
      error: 'Project name can only contain letters, numbers, spaces, hyphens, and underscores',
    }
  }

  return { isValid: true }
}
