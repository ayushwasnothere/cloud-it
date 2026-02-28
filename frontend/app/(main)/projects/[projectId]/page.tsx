'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useEditorStore } from '@/state/editorStore'
import { Project } from '@/types'
import {
  createProjectDirectory,
  deleteProjectFile,
  getProject,
  listProjectFiles,
  readProjectFile,
  saveProjectFile,
  type ProjectFileEntry,
} from '@/api/projects'
import { TopBar } from '@/components/layout/TopBar'
import { Editor } from '@/components/editor/Editor'
import { FileBrowser } from '@/components/editor/FileBrowser'
import { Terminal } from '@/components/terminal/Terminal'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { RefreshCcw, PanelBottomClose, PanelBottomOpen } from 'lucide-react'
import { toast } from 'sonner'

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'shell',
  }
  return map[ext || ''] || 'plaintext'
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const { logout } = useAuth()
  const { projects, deleteProject, startProject, stopProject } = useProjects(false)

  const {
    tabs,
    activeTabId,
    files,
    addTab,
    removeTab,
    setActiveTab,
    updateFile,
    markFileSaved,
    reset,
  } = useEditorStore()

  const [project, setProject] = useState<Project | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(true)
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [terminalVisible, setTerminalVisible] = useState(true)
  const [projectActionLoading, setProjectActionLoading] = useState<'start' | 'stop' | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [workspaceFiles, setWorkspaceFiles] = useState<ProjectFileEntry[]>([])

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId) ?? null, [tabs, activeTabId])
  const activeFile = useMemo(
    () => (activeTab ? files[activeTab.fileId] ?? null : null),
    [activeTab, files]
  )

  const loadProjectFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    try {
      const entries = await listProjectFiles(projectId)
      setWorkspaceFiles(entries)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load project files')
    } finally {
      setIsLoadingFiles(false)
    }
  }, [projectId])

  const openFile = useCallback(
    async (path: string) => {
      const existingTab = tabs.find((tab) => tab.fileId === path)
      if (existingTab) {
        setActiveTab(existingTab.id)
        return
      }

      try {
        const file = await readProjectFile(projectId, path)
        const tabId = `tab:${file.path}`

        addTab(
          {
            id: tabId,
            fileId: file.path,
            name: file.name,
            isDirty: false,
          },
          {
            id: file.path,
            name: file.name,
            path: file.path,
            content: file.content,
            language: detectLanguage(file.name),
            isSaved: true,
          }
        )
        setEditorContent(file.content)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to open file')
      }
    },
    [addTab, projectId, setActiveTab, tabs]
  )

  useEffect(() => {
    let cancelled = false

    const hydrateProject = async () => {
      setIsLoadingProject(true)
      const fromStore = projects.find((p) => p.id === projectId) ?? null
      if (fromStore) {
        if (!cancelled) setProject(fromStore)
      } else {
        try {
          const fresh = await getProject(projectId)
          if (!cancelled) setProject(fresh)
        } catch {
          if (!cancelled) {
            toast.error('Project not found')
            router.push('/dashboard')
            return
          }
        }
      }

      if (!cancelled) {
        await loadProjectFiles()
        setIsLoadingProject(false)
      }
    }

    hydrateProject()

    return () => {
      cancelled = true
    }
  }, [loadProjectFiles, projectId, router])

  useEffect(() => {
    const fromStore = projects.find((p) => p.id === projectId)
    if (fromStore) {
      setProject(fromStore)
      setIsLoadingProject(false)
    }
  }, [projectId, projects])

  useEffect(() => {
    return () => {
      reset()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [reset])

  useEffect(() => {
    if (!activeFile) return
    setEditorContent(activeFile.content)
  }, [activeFile])

  useEffect(() => {
    if (!activeFile || activeFile.isSaved || !project) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProjectFile(project.id, activeFile.path, activeFile.content)
        markFileSaved(activeFile.id)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Auto-save failed')
      }
    }, 700)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [activeFile, markFileSaved, project])

  const handleStart = async () => {
    if (!project) return
    setProjectActionLoading('start')
    try {
      const updated = await startProject(project.id)
      setProject(updated)
      toast.success('Project started')
    } catch {
      toast.error('Failed to start project')
    } finally {
      setProjectActionLoading(null)
    }
  }

  const handleStop = async () => {
    if (!project) return
    setProjectActionLoading('stop')
    try {
      const updated = await stopProject(project.id)
      setProject(updated)
      toast.success('Project stopped')
    } catch {
      toast.error('Failed to stop project')
    } finally {
      setProjectActionLoading(null)
    }
  }

  const handleTerminalExit = async () => {
    if (!project || project.status !== 'running') return
    try {
      const updated = await stopProject(project.id)
      setProject(updated)
      toast.info('Terminal exited, project stopped')
    } catch {
      setProject((prev) => (prev ? { ...prev, status: 'stopped' } : prev))
    }
  }

  const handleDelete = async () => {
    if (!project) return
    try {
      await deleteProject(project.id)
      toast.success('Project deleted')
      router.push('/dashboard')
    } catch {
      toast.error('Failed to delete project')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      toast.error('Failed to logout')
    }
  }

  const handleEditorChange = (value: string) => {
    setEditorContent(value)
    if (!activeTab) return
    updateFile(activeTab.fileId, value)
  }

  const handleCloseTab = (tabId: string) => {
    removeTab(tabId)
  }

  const handleCreateFile = async (path: string) => {
    if (!project) return
    const normalizedPath = path.trim().replace(/^\/+/, '')
    if (!normalizedPath) return
    if (normalizedPath.endsWith('/')) {
      toast.error('File path cannot end with "/"')
      return
    }

    try {
      await saveProjectFile(project.id, normalizedPath, '')
      await loadProjectFiles()
      await openFile(normalizedPath)
      toast.success(`Created ${normalizedPath}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create file')
    }
  }

  const handleCreateDirectory = async (path: string) => {
    if (!project) return
    const normalizedPath = path.trim().replace(/^\/+/, '').replace(/\/+$/, '')
    if (!normalizedPath) return

    try {
      await createProjectDirectory(project.id, normalizedPath)
      await loadProjectFiles()
      toast.success(`Created ${normalizedPath}/`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create folder')
    }
  }

  const handleDeleteFile = async (path: string) => {
    if (!project) return
    const normalizedPath = path.trim().replace(/^\/+/, '')
    if (!normalizedPath) return

    try {
      await deleteProjectFile(project.id, normalizedPath)
      for (const tab of tabs) {
        if (tab.fileId === normalizedPath) {
          removeTab(tab.id)
        }
      }
      await loadProjectFiles()
      toast.success(`Deleted ${normalizedPath}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete file')
    }
  }

  if (isLoadingProject || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-8 text-app-muted" />
          <p className="text-sm text-app-muted">Loading IDE...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-app-editor-bg text-app-text">
      <TopBar
        project={project}
        onStart={handleStart}
        onStop={handleStop}
        onDelete={() => setShowDeleteConfirm(true)}
        onLogout={handleLogout}
        isLoading={projectActionLoading !== null}
        loadingAction={projectActionLoading}
      />

      <div className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={22} minSize={16} maxSize={38} className="hidden sm:block">
            <FileBrowser
              files={workspaceFiles}
              activePath={activeFile?.path ?? null}
              onOpenFile={openFile}
              onCreateFile={handleCreateFile}
              onCreateDirectory={handleCreateDirectory}
              onDeleteFile={handleDeleteFile}
              onRefresh={loadProjectFiles}
              onToggleTerminal={() => setTerminalVisible((value) => !value)}
              isTerminalVisible={terminalVisible}
              projectName={project.name}
            />
          </ResizablePanel>

          <ResizableHandle className="hidden bg-app-border hover:bg-app-border-strong sm:flex" />

          <ResizablePanel defaultSize={78} minSize={55}>
            {terminalVisible ? (
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={70} minSize={40}>
                  <section className="flex h-full flex-col bg-app-editor-bg">
                    <div className="flex items-center justify-between border-b border-app-border bg-app-editor-header">
                      <div className="flex min-w-0 items-center overflow-x-auto">
                        {tabs.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-app-subtle">No file open</div>
                        ) : (
                          tabs.map((tab) => (
                            <div
                              key={tab.id}
                              className={`group flex items-center gap-2 border-r border-app-border px-3 py-2 text-xs transition-colors ${
                                activeTabId === tab.id
                                  ? 'bg-app-editor-bg text-app-text'
                                  : 'bg-app-surface-2 text-app-muted hover:text-app-text'
                              }`}
                            >
                              <button onClick={() => setActiveTab(tab.id)}>{tab.name}</button>
                              {tab.isDirty && <span className="text-app-primary">●</span>}
                              <button
                                onClick={() => handleCloseTab(tab.id)}
                                className="rounded px-1 text-app-subtle opacity-0 hover:bg-app-surface-3 hover:text-app-text group-hover:opacity-100"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mr-2 flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={loadProjectFiles}
                          disabled={isLoadingFiles}
                          className="h-7 gap-1 text-xs text-app-muted hover:bg-app-surface-3"
                        >
                          <RefreshCcw className={`h-3.5 w-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTerminalVisible(false)}
                          className="h-7 gap-1 text-xs text-app-muted hover:bg-app-surface-3"
                        >
                          <PanelBottomClose className="h-3.5 w-3.5" />
                          Hide Terminal
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      {activeFile ? (
                        <Editor
                          filename={activeFile.name}
                          filePath={activeFile.path}
                          value={editorContent}
                          onChange={handleEditorChange}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-app-subtle">
                          Open a file from the Explorer
                        </div>
                      )}
                    </div>
                  </section>
                </ResizablePanel>

                <ResizableHandle className="bg-app-border hover:bg-app-border-strong" />

                <ResizablePanel defaultSize={30} minSize={15} maxSize={60}>
                  <Terminal
                    projectId={project.id}
                    isRunning={project.status === 'running'}
                    onSessionExit={handleTerminalExit}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <section className="flex h-full flex-col bg-app-editor-bg">
                <div className="flex items-center justify-between border-b border-app-border bg-app-editor-header">
                  <div className="flex min-w-0 items-center overflow-x-auto">
                    {tabs.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-app-subtle">No file open</div>
                    ) : (
                      tabs.map((tab) => (
                        <div
                          key={tab.id}
                          className={`group flex items-center gap-2 border-r border-app-border px-3 py-2 text-xs transition-colors ${
                            activeTabId === tab.id
                              ? 'bg-app-editor-bg text-app-text'
                              : 'bg-app-surface-2 text-app-muted hover:text-app-text'
                          }`}
                        >
                          <button onClick={() => setActiveTab(tab.id)}>{tab.name}</button>
                          {tab.isDirty && <span className="text-app-primary">●</span>}
                          <button
                            onClick={() => handleCloseTab(tab.id)}
                            className="rounded px-1 text-app-subtle opacity-0 hover:bg-app-surface-3 hover:text-app-text group-hover:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mr-2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={loadProjectFiles}
                      disabled={isLoadingFiles}
                      className="h-7 gap-1 text-xs text-app-muted hover:bg-app-surface-3"
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTerminalVisible(true)}
                      className="h-7 gap-1 text-xs text-app-muted hover:bg-app-surface-3"
                    >
                      <PanelBottomOpen className="h-3.5 w-3.5" />
                      Open Terminal
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  {activeFile ? (
                    <Editor
                      filename={activeFile.name}
                      filePath={activeFile.path}
                      value={editorContent}
                      onChange={handleEditorChange}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-app-subtle">
                      Open a file from the Explorer
                    </div>
                  )}
                </div>
              </section>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="border-app-border bg-app-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-app-text">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-app-muted">
              This action cannot be undone. All files and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <AlertDialogCancel className="border-app-border text-app-text hover:bg-app-surface-2">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-app-danger text-white hover:bg-app-danger-hover">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
