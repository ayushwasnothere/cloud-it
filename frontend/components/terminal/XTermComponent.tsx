'use client'

import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface IncomingTerminalData {
  id: number
  data: string
}

interface XTermComponentProps {
  isConnected: boolean
  isConnecting: boolean
  isRunning: boolean
  incomingData: IncomingTerminalData | null
  onData: (data: string) => void
}

export function XTermComponent({
  isConnected,
  isConnecting,
  isRunning,
  incomingData,
  onData,
}: XTermComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const lastStatusRef = useRef<string>('')
  const rafRef = useRef<number | null>(null)
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const disposedRef = useRef(false)

  useEffect(() => {
    if (!terminalRef.current) return

    disposedRef.current = false
    let dataDisposable: { dispose: () => void } | null = null
    let resizeObserver: ResizeObserver | null = null
    let fitAddon: FitAddon | null = null
    let handleResize: (() => void) | null = null

    initTimeoutRef.current = setTimeout(() => {
      if (disposedRef.current || !terminalRef.current) return

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        lineHeight: 1.35,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        convertEol: true,
        theme: {
          background: '#0b1118',
          foreground: '#eef4ff',
          cursor: '#eef4ff',
          black: '#0b1118',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#eef4ff',
          brightBlack: '#7e8ea7',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
      })

      fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(terminalRef.current)

      rafRef.current = requestAnimationFrame(() => {
        if (disposedRef.current || !fitAddon) return
        try {
          fitAddon.fit()
        } catch {
          // noop
        }
      })

      dataDisposable = terminal.onData((data) => {
        onData(data)
      })

      handleResize = () => {
        if (disposedRef.current || !fitAddon) return
        try {
          fitAddon.fit()
        } catch {
          // noop
        }
      }

      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(terminalRef.current)
      window.addEventListener('resize', handleResize)

      terminalInstanceRef.current = terminal
    }, 0)

    return () => {
      disposedRef.current = true
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
        initTimeoutRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      dataDisposable?.dispose()
      resizeObserver?.disconnect()
      if (handleResize) {
        window.removeEventListener('resize', handleResize)
      }
      terminalInstanceRef.current?.dispose()
      terminalInstanceRef.current = null
      lastStatusRef.current = ''
    }
  }, [onData])

  useEffect(() => {
    if (!terminalInstanceRef.current || !incomingData) return
    terminalInstanceRef.current.write(incomingData.data)
  }, [incomingData])

  useEffect(() => {
    if (!terminalInstanceRef.current) return

    let nextStatus = ''
    if (!isRunning) {
      nextStatus = 'Session is not started. Start project to access the terminal.\r\n'
    } else if (isConnecting) {
      nextStatus = 'Connecting to runtime shell...\r\n'
    } else if (isConnected) {
      nextStatus = 'Connected. Press Enter to start terminal session.\r\n'
    } else {
      nextStatus = 'Disconnected from runtime shell.\r\n'
    }

    if (lastStatusRef.current !== nextStatus) {
      terminalInstanceRef.current.write(`\x1b[90m${nextStatus}\x1b[0m`)
      lastStatusRef.current = nextStatus
    }
  }, [isConnected, isConnecting, isRunning])

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{
        background: '#0b1118',
        overflow: 'hidden',
      }}
    />
  )
}
