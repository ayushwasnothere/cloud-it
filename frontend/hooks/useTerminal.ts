import { useEffect, useRef, useCallback, useState } from 'react'
import {
  TERMINAL_RECONNECT_DELAY,
  TERMINAL_MAX_RECONNECT_ATTEMPTS,
  TERMINAL_RECONNECT_MULTIPLIER,
  WS_CLOSE_REASONS,
} from '@/utils/constants'

const NON_RETRIABLE_CLOSE_CODES = new Set([1000, 1008, 4000, 4001, 4004, 4029])
const WS_HEARTBEAT_PAYLOAD = '__v0_ping__'
const WS_HEARTBEAT_INTERVAL_MS = 25000

interface TerminalHookOptions {
  projectId: string
  enabled?: boolean
  onConnect?: () => void
  onDisconnect?: (code: number) => void
  onError?: (error: string) => void
  onData?: (data: string) => void
}

export function useTerminal({
  projectId,
  enabled = true,
  onConnect,
  onDisconnect,
  onError,
  onData,
}: TerminalHookOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const isConnectingRef = useRef(false)
  const shouldReconnectRef = useRef(true)
  const isIntentionalCloseRef = useRef(false)
  const callbacksRef = useRef({ onConnect, onDisconnect, onError, onData })
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectRef = useRef<(() => void) | null>(null)
  const pendingSendsRef = useRef<string[]>([])
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    callbacksRef.current = { onConnect, onDisconnect, onError, onData }
  }, [onConnect, onDisconnect, onError, onData])

  const getWsUrl = useCallback(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006'
    const apiUrl = new URL(baseUrl)
    apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    apiUrl.pathname = `/terminal/${projectId}`
    apiUrl.search = ''
    apiUrl.hash = ''
    return apiUrl.toString()
  }, [projectId])

  const attemptReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) return

    if (reconnectAttemptsRef.current >= TERMINAL_MAX_RECONNECT_ATTEMPTS) {
      callbacksRef.current.onError?.(
        `Failed to connect to terminal after ${TERMINAL_MAX_RECONNECT_ATTEMPTS} attempts`
      )
      return
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const delay =
      TERMINAL_RECONNECT_DELAY *
      Math.pow(TERMINAL_RECONNECT_MULTIPLIER, reconnectAttemptsRef.current)
    reconnectAttemptsRef.current += 1

    console.log(
      `[v0] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
    )
    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current?.()
    }, delay)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback(() => {
    stopHeartbeat()
    heartbeatIntervalRef.current = setInterval(() => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(WS_HEARTBEAT_PAYLOAD)
      } catch {
        // noop
      }
    }, WS_HEARTBEAT_INTERVAL_MS)
  }, [stopHeartbeat])

  const connect = useCallback(() => {
    if (!enabled) return
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return
    }
    if (isConnectingRef.current) return

    shouldReconnectRef.current = true
    isIntentionalCloseRef.current = false
    isConnectingRef.current = true
    setIsConnecting(true)

    try {
      const url = getWsUrl()
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('[v0] WebSocket connected')
        setIsConnected(true)
        isConnectingRef.current = false
        setIsConnecting(false)
        reconnectAttemptsRef.current = 0
        if (pendingSendsRef.current.length > 0) {
          while (pendingSendsRef.current.length > 0) {
            const message = pendingSendsRef.current[0]
            try {
              ws.send(message)
              pendingSendsRef.current.shift()
            } catch {
              break
            }
          }
        }
        startHeartbeat()
        callbacksRef.current.onConnect?.()
      }

      ws.onmessage = (event) => {
        callbacksRef.current.onData?.(event.data)
      }

      ws.onerror = (event) => {
        // Ignore stale socket errors and expected close errors during cleanup/reconnect.
        if (wsRef.current !== ws) return
        if (isIntentionalCloseRef.current) return
        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
          return
        }

        console.error('[v0] WebSocket error', {
          event,
          url,
          readyState: ws.readyState,
        })
        const errorMsg = 'Terminal connection error (see console for details)'
        callbacksRef.current.onError?.(errorMsg)
      }

      ws.onclose = (event) => {
        if (wsRef.current !== ws) return

        console.log('[v0] WebSocket closed:', event.code, event.reason)
        wsRef.current = null
        setIsConnected(false)
        isConnectingRef.current = false
        setIsConnecting(false)
        stopHeartbeat()
        callbacksRef.current.onDisconnect?.(event.code)
        if (event.code !== 1000) {
          const reason = WS_CLOSE_REASONS[event.code] || event.reason || 'Unknown reason'
          callbacksRef.current.onError?.(
            `Terminal disconnected: ${reason} (code ${event.code})`
          )
        }

        // Retry only for transient disconnects, not policy/auth/session-limit failures.
        if (!NON_RETRIABLE_CLOSE_CODES.has(event.code) && shouldReconnectRef.current) {
          attemptReconnect()
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[v0] WebSocket error:', error)
      isConnectingRef.current = false
      setIsConnecting(false)
      callbacksRef.current.onError?.(
        error instanceof Error ? error.message : 'Failed to connect'
      )
      attemptReconnect()
    }
  }, [attemptReconnect, enabled, getWsUrl, startHeartbeat, stopHeartbeat])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const send = useCallback((data: string) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data)
      return
    }

    // Queue keystrokes when socket is not open so fast typing does not get dropped.
    pendingSendsRef.current.push(data)
    if (pendingSendsRef.current.length > 1000) {
      pendingSendsRef.current.shift()
    }

    if (enabled && shouldReconnectRef.current && !isConnectingRef.current) {
      connect()
    }
  }, [connect, enabled])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    isIntentionalCloseRef.current = true
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    stopHeartbeat()
    pendingSendsRef.current = []
    if (wsRef.current) {
      const ws = wsRef.current
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => {
          try {
            ws.close(1000)
          } catch {
            // noop
          }
        }
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000)
      } else {
        ws.close()
      }
      wsRef.current = null
    }
    isConnectingRef.current = false
    setIsConnecting(false)
    setIsConnected(false)
  }, [stopHeartbeat])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (!enabled) {
      disconnect()
      return
    }

    connectTimeoutRef.current = setTimeout(() => {
      connect()
    }, 0)

    return () => {
      disconnect()
    }
  }, [connect, disconnect, enabled, projectId])

  return {
    isConnected,
    isConnecting,
    send,
    disconnect,
    reconnect: connect,
  }
}
