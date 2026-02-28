// Auth Types
export interface User {
  id: string
  name: string
  email: string
  createdAt?: string
  updatedAt?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignUpInput {
  name: string
  email: string
  password: string
}

// Project Types
export interface Project {
  id: string
  name: string
  runtime: string
  status: 'running' | 'stopped' | 'starting' | 'stopping'
  createdAt: string
  preview?: {
    available: boolean
    url: string | null
    port: number
    hostPort: number | null
  }
  container?: {
    id: string
    port: number
  }
}

export interface ProjectsState {
  projects: Project[]
  selectedProject: Project | null
  isLoading: boolean
  error: string | null
}

export interface CreateProjectInput {
  name: string
  runtime: string
}

// Editor Types
export interface EditorFile {
  id: string
  name: string
  path: string
  content: string
  language: string
  isSaved: boolean
}

export interface EditorTab {
  id: string
  fileId: string
  name: string
  isDirty: boolean
}

export interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  files: Record<string, EditorFile>
  isLoading: boolean
  error: string | null
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// Terminal Types
export interface TerminalMessage {
  type: 'output' | 'error' | 'input'
  data: string
  timestamp: number
}

export interface TerminalState {
  isConnected: boolean
  messages: TerminalMessage[]
  sessionId: string | null
  error: string | null
}

// WebSocket Types
export interface WSMessage {
  type: string
  payload?: any
  error?: string
}

// Status Types
export type ProjectStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error'

