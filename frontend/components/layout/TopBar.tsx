'use client'

import { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { ChevronDown, Play, Square, Trash2, LogOut } from 'lucide-react'
import { STATUS_COLORS } from '@/utils/constants'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import Link from 'next/link'

interface TopBarProps {
  project: Project
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  onDelete: () => void
  onLogout: () => void
  isLoading: boolean
  loadingAction?: 'start' | 'stop' | null
}

export function TopBar({
  project,
  onStart,
  onStop,
  onDelete,
  onLogout,
  isLoading,
  loadingAction = null,
}: TopBarProps) {
  const statusColor = STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]
  const isRunning = project.status === 'running'
  const isTransitioning = project.status === 'starting' || project.status === 'stopping'

  const debouncedStart = useDebouncedCallback(onStart, 300)
  const debouncedStop = useDebouncedCallback(onStop, 300)

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
          <h1 className="text-lg font-semibold text-neutral-50">Cloud IDE</h1>
        </Link>
        <div className="h-6 w-px bg-neutral-700" />
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-medium text-neutral-50">{project.name}</h2>
            <p className="text-xs text-neutral-400">{project.runtime}</p>
          </div>
          <Badge
            className="ml-2"
            style={{
              backgroundColor: statusColor,
              opacity: 0.9,
            }}
          >
            {project.status === 'running' && 'Running'}
            {project.status === 'stopped' && 'Stopped'}
            {project.status === 'starting' && (
              <span className="flex items-center gap-1">
                <Spinner className="size-3" />
                Starting
              </span>
            )}
            {project.status === 'stopping' && (
              <span className="flex items-center gap-1">
                <Spinner className="size-3" />
                Stopping
              </span>
            )}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            onClick={() => debouncedStop()}
            disabled={isLoading || isTransitioning}
            variant="outline"
            size="sm"
            className="border-[#3a3c44] bg-[#21232a] text-neutral-100 hover:bg-[#2b2d35] hover:text-white"
          >
            {loadingAction === 'stop' ? (
              <Spinner className="mr-2 size-4" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            {loadingAction === 'stop' ? 'Stopping...' : 'Stop'}
          </Button>
        ) : (
          <Button
            onClick={() => debouncedStart()}
            disabled={isLoading || isTransitioning}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loadingAction === 'start' ? (
              <Spinner className="mr-2 size-4" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {loadingAction === 'start' ? 'Starting...' : 'Start'}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-[#3a3c44] bg-[#21232a] text-neutral-100 hover:bg-[#2b2d35] hover:text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-neutral-800 border-neutral-700">
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-400 focus:bg-red-900/20 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem
              onClick={onLogout}
              className="text-neutral-300 focus:bg-neutral-700 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
