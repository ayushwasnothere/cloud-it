import { ApiResponse } from '@/types'

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006'

interface RequestOptions extends RequestInit {
  includeCredentials?: boolean
}

export async function createApiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    includeCredentials = true,
    headers = {},
    ...restOptions
  } = options

  const url = `${API_BASE_URL}${endpoint}`

  const fetchOptions: RequestInit = {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(includeCredentials && { credentials: 'include' }),
  }

  try {
    const response = await fetch(url, fetchOptions)

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Clear auth and redirect will be handled by auth store
      throw new ApiError('Unauthorized', 'Session expired', 401)
    }

    // Handle 404 Not Found
    if (response.status === 404) {
      throw new ApiError('NotFound', 'Resource not found', 404)
    }

    // Handle 429 Rate Limit
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60'
      throw new ApiError('RateLimit', `Too many requests. Retry after ${retryAfter}s`, 429)
    }

    // Handle 400 Bad Request
    if (response.status === 400) {
      const data = await response.json()
      throw new ApiError('BadRequest', data.message || 'Bad request', 400)
    }

    // Handle server errors
    if (response.status >= 500) {
      throw new ApiError('ServerError', 'Server error occurred', response.status)
    }

    // Parse response
    if (response.status === 204) {
      return {} as T
    }

    const data = await response.json()

    if (!response.ok) {
      // Handle both ApiResponse format and plain error messages
      const errorMessage = 
        typeof data === 'object' && data.error ? data.error :
        typeof data === 'object' && data.message ? data.message :
        typeof data === 'string' ? data :
        'Request failed'
      throw new ApiError(
        'RequestFailed',
        errorMessage,
        response.status
      )
    }

    // Return data directly if it's not wrapped in ApiResponse format
    // The backend returns raw objects like {token: "..."} or {id: "...", ...}
    return data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // Network error
    if (error instanceof TypeError) {
      throw new ApiError('NetworkError', 'Network request failed', 0)
    }

    throw new ApiError('UnknownError', 'An unknown error occurred', 0)
  }
}
