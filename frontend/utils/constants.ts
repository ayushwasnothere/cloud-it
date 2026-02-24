export const RUNTIMES = [
  { id: 'node', label: 'Node.js', value: 'node' },
  { id: 'python', label: 'Python', value: 'python' },
  { id: 'bun', label: 'Bun', value: 'bun' },
]

export const PROJECT_POLL_INTERVAL = 5000 // 5 seconds
export const MAX_POLL_INTERVAL = 30000 // 30 seconds
export const BACKOFF_MULTIPLIER = 1.5

export const DEBOUNCE_DELAY = 300 // ms

export const EDITOR_AUTO_SAVE_DELAY = 500 // ms

export const TERMINAL_RECONNECT_DELAY = 1000 // ms
export const TERMINAL_MAX_RECONNECT_ATTEMPTS = 5
export const TERMINAL_RECONNECT_MULTIPLIER = 2

export const WS_CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED_DATA: 1003,
  NO_STATUS: 1005,
  ABNORMAL_CLOSURE: 1006,
  INVALID_FRAME_PAYLOAD: 1007,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  MISSING_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  SHELL_EXITED: 4000,
  UNAUTHORIZED: 4001,
  NOT_FOUND: 4004,
  RATE_LIMITED: 4029,
}

export const WS_CLOSE_REASONS: Record<number, string> = {
  1000: 'Normal closure',
  1001: 'Going away',
  1002: 'Protocol error',
  1003: 'Unsupported data',
  1005: 'No status',
  1006: 'Abnormal closure',
  1007: 'Invalid payload',
  1008: 'Policy violation',
  1009: 'Message too big',
  1010: 'Missing extension',
  1011: 'Internal error',
  1012: 'Service restart',
  1013: 'Try again later',
  4000: 'Shell exited',
  4001: 'Unauthorized - please login again',
  4004: 'Project not found',
  4029: 'Too many terminal sessions open',
}

export const KEYBOARD_SHORTCUTS = {
  SAVE: 'Ctrl+S (or Cmd+S)',
  TERMINAL: 'Ctrl+` (backtick)',
  COMMAND_PALETTE: 'Ctrl+Shift+P',
}

export const THEME = {
  colors: {
    bg: '#000000',
    surface: '#1a1a1a',
    surfaceAlt: '#262626',
    border: '#404040',
    text: '#ececec',
    textSecondary: '#a0a0a0',
    accent: '#0070f3',
    success: '#0caf00',
    error: '#ff0000',
    warning: '#ffa500',
  },
  fonts: {
    mono: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Courier, monospace',
  },
}

export const STATUS_COLORS = {
  running: '#0caf00',
  stopped: '#808080',
  starting: '#ffa500',
  stopping: '#ffa500',
  error: '#ff0000',
}

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Your session has expired. Please login again.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TERMINAL_CONNECTION_FAILED: 'Failed to connect to terminal. Please try again.',
  PROJECT_LOAD_FAILED: 'Failed to load project. Please try again.',
}
