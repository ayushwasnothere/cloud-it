'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LogOut, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { projects, isLoading, createProject, deleteProject } = useProjects()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCreateProject = useCallback(
    async (name: string, runtime: string) => {
      setIsCreating(true)
      try {
        await createProject({ name, runtime })
      } finally {
        setIsCreating(false)
      }
    },
    [createProject]
  )

  const handleDeleteProject = useCallback(
    async (id: string) => {
      setIsDeleting(true)
      try {
        await deleteProject(id)
        setDeleteConfirm(null)
        toast.success('Project deleted')
      } catch {
        toast.error('Failed to delete project')
      } finally {
        setIsDeleting(false)
      }
    },
    [deleteProject]
  )

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      toast.error('Failed to logout')
    }
  }, [logout])

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-50">Cloud IDE</h1>
              <p className="text-sm text-neutral-400">
                Welcome back, {user?.name}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="border-neutral-700 text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-neutral-50">
                Your Projects
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>

          {isLoading ? (
  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <Skeleton key={i} className="h-48 bg-neutral-800" />
    ))}
  </div>
) : projects.length === 0 ? (
  <div className="text-center py-12">
    <p className="text-neutral-400 mb-4">No projects yet</p>
    <Button
      onClick={() => setCreateModalOpen(true)}
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      Create Your First Project
    </Button>
  </div>
) : (
  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
    {projects.map((project) => (
      <ProjectCard
        key={project.id}
        project={project}
        onDelete={(id) => setDeleteConfirm(id)}
        isDeleting={isDeleting}
      />
    ))}
  </div>
)}
        </div>
      </main>

      {/* Modals */}
      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreate={handleCreateProject}
        isLoading={isCreating}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-neutral-900 border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neutral-50">
              Delete Project?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              This action cannot be undone. All files and data will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <AlertDialogCancel className="border-neutral-700 text-neutral-50 hover:bg-neutral-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteProject(deleteConfirm)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
