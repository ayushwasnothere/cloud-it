'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RUNTIMES } from '@/utils/constants'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, runtime: string) => Promise<void>
  isLoading: boolean
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onCreate,
  isLoading,
}: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [runtime, setRuntime] = useState('node20')

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Project name is required')
      return
    }

    try {
      await onCreate(name, runtime)
      setName('')
      setRuntime('node20')
      onOpenChange(false)
      toast.success('Project created successfully!')
    } catch {
      toast.error('Failed to create project')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-surface border-app-border">
        <DialogHeader>
          <DialogTitle className="text-app-text">
            Create New Project
          </DialogTitle>
          <DialogDescription className="text-app-muted">
            Set up a new project with your preferred runtime
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-app-muted mb-2">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              disabled={isLoading}
              className="bg-app-surface-2 border-app-border text-app-text placeholder-app-subtle"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-app-muted mb-2">
              Runtime
            </label>
            <Select value={runtime} onValueChange={setRuntime} disabled={isLoading}>
              <SelectTrigger className="bg-app-surface-2 border-app-border text-app-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-app-surface-2 border-app-border">
                {RUNTIMES.map((rt) => (
                  <SelectItem
                    key={rt.id}
                    value={rt.value}
                    className="text-app-text"
                  >
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="border-app-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isLoading}
              className="bg-app-primary hover:bg-app-primary-hover text-white"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Creating...
                </div>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
