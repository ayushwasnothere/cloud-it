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
    <Card className="bg-app-surface border-app-border hover:border-app-border-strong transition-colors overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-app-text truncate">
              {project.name}
            </h3>
            <p className="text-sm text-app-muted mt-1">
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

        <p className="text-xs text-app-subtle mb-4">
          Created {format(new Date(project.createdAt), 'MMM d, yyyy')}
        </p>

        <div className="flex gap-2">
          <Link href={`/projects/${project.id}`} className="flex-1">
            <Button className="w-full bg-app-primary hover:bg-app-primary-hover text-black font-medium border border-transparent">
              Open IDE
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDelete(project.id)}
            disabled={isDeleting}
            className="border-app-danger/50 bg-app-surface text-app-danger hover:bg-app-danger-soft hover:text-app-danger"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
