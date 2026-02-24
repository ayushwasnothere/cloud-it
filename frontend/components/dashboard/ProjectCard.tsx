'use client'

import { Project } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'
import { STATUS_COLORS } from '@/utils/constants'
import { format } from 'date-fns'

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  isDeleting: boolean
}

export function ProjectCard({ project, onDelete, isDeleting }: ProjectCardProps) {
  const statusColor = STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]

  return (
    <Card className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-neutral-50 truncate">
              {project.name}
            </h3>
            <p className="text-sm text-neutral-400 mt-1">
              {project.runtime}
            </p>
          </div>
          <Badge
            className="ml-2 shrink-0"
            style={{
              backgroundColor: statusColor,
              opacity: 0.9,
            }}
          >
            {project.status === 'running' && 'Running'}
            {project.status === 'stopped' && 'Stopped'}
          </Badge>
        </div>

        <p className="text-xs text-neutral-500 mb-4">
          Created {format(new Date(project.createdAt), 'MMM d, yyyy')}
        </p>

        <div className="flex gap-2">
          <Link href={`/projects/${project.id}`} className="flex-1">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Open IDE
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDelete(project.id)}
            disabled={isDeleting}
            className="border-neutral-700 hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
