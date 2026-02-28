'use client'

import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTerminal } from '@/hooks/useTerminal'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle } from 'lucide-react'
import { WS_CLOSE_REASONS } from '@/utils/constants'

const XTermComponent = dynamic(
  () => import('./XTermComponent').then((mod) => mod.XTermComponent),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center bg-app-terminal-bg">
        <div className="flex flex-col items-center gap-2 text-xs text-app-muted">
          <Spinner className="size-4" />
          <p>Preparing terminal...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

interface TerminalProps {
  projectId: string
  isRunning: boolean
  onSessionExit?: () => void | Promise<void>
}

export function Terminal({ projectId, isRunning, onSessionExit }: TerminalProps) {
  const [closeReason, setCloseReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const outputSeqRef = useRef(0)
  const [incomingData, setIncomingData] = useState<{ id: number; data: string } | null>(null)

  const { isConnected, isConnecting, send } = useTerminal({
    projectId,
    enabled: isRunning,
    onConnect: () => {
      setCloseReason(null)
      setError(null)
    },
    onDisconnect: (code) => {
      const reason = WS_CLOSE_REASONS[code] || `Disconnected (${code})`
      setCloseReason(reason)
      if (code === 4000) {
        onSessionExit?.()
      }
    },
    onError: (errorMsg) => {
      setError(errorMsg)
    },
    onData: (data) => {
      outputSeqRef.current += 1
      setIncomingData({ id: outputSeqRef.current, data })
    },
  })

  const statusLabel = useMemo(() => {
    if (!isRunning) return 'Stopped'
    if (isConnecting) return 'Connecting'
    if (isConnected) return 'Connected'
    return 'Disconnected'
  }, [isConnected, isConnecting, isRunning])

  const statusColor = useMemo(() => {
    if (!isRunning) return 'bg-app-subtle'
    if (isConnecting) return 'bg-app-warning'
    if (isConnected) return 'bg-app-success'
    return 'bg-app-danger'
  }, [isConnected, isConnecting, isRunning])

  return (
    <div className="flex h-full flex-col border-t border-app-border bg-app-terminal-bg">
      <div className="flex items-center justify-between border-b border-app-border bg-app-terminal-header px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-app-muted">
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span>{statusLabel}</span>
          {isConnected && (
            <span className="rounded border border-app-border-strong bg-app-surface-2 px-1.5 py-0.5 text-[10px] text-app-muted">
              Press Enter
            </span>
          )}
        </div>

        {error && (
          <div className="flex max-w-[70%] items-center gap-1 text-app-danger">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {closeReason && !isConnected && !error && (
          <span className="max-w-[70%] truncate text-app-subtle">{closeReason}</span>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <XTermComponent
          isConnected={isConnected}
          isConnecting={isConnecting}
          isRunning={isRunning}
          incomingData={incomingData}
          onData={send}
        />
      </div>
    </div>
  )
}
