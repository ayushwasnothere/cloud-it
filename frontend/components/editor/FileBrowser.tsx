'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Menu,
  FileText,
  Search,
  Boxes,
  Folder,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FolderPlus,
  RefreshCw,
  ChevronsUpDown,
  Trash2,
  Copy,
  Download,
  Terminal as TerminalIcon,
  Pencil,
  Scissors,
  ClipboardPaste,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { toast } from 'sonner'
import type { ProjectFileEntry } from '@/api/projects'

type SidebarMode = 'explorer' | 'search' | 'extensions'

type CreateKind = 'file' | 'directory'

interface FileBrowserProps {
  files: ProjectFileEntry[]
  activePath: string | null
  onOpenFile: (path: string) => void
  onCreateFile: (path: string) => Promise<void> | void
  onCreateDirectory: (path: string) => Promise<void> | void
  onDeleteFile: (path: string) => Promise<void> | void
  onRefresh: () => void
  onToggleTerminal?: () => void
  isTerminalVisible?: boolean
  projectName: string
  projectId: string
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children: TreeNode[]
}

interface DraftCreate {
  kind: CreateKind
  parentPath: string
  value: string
}

function buildTree(files: ProjectFileEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  const map = new Map<string, TreeNode>()

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
  for (const entry of sorted) {
    const parts = entry.path.split('/').filter(Boolean)
    let parent: TreeNode | null = null

    for (let i = 0; i < parts.length; i += 1) {
      const name = parts[i]
      const path = parts.slice(0, i + 1).join('/')
      const isLast = i === parts.length - 1
      const type: 'file' | 'directory' = isLast ? entry.type : 'directory'

      let node = map.get(path)
      if (!node) {
        node = { name, path, type, children: [] }
        map.set(path, node)
        if (parent) {
          parent.children.push(node)
        } else {
          root.push(node)
        }
      }
      parent = node
    }
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) sort(n.children)
  }
  sort(root)
  return root
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return ''
  return path.slice(0, idx)
}

function joinPath(parentPath: string, value: string): string {
  const cleanValue = value.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (!parentPath) return cleanValue
  if (!cleanValue) return parentPath
  return `${parentPath}/${cleanValue}`.replace(/\/+/g, '/').replace(/^\/+/, '')
}

export function FileBrowser({
  files,
  activePath,
  onOpenFile,
  onCreateFile,
  onCreateDirectory,
  onDeleteFile,
  onRefresh,
  onToggleTerminal,
  isTerminalVisible = true,
  projectName,
  projectId,
}: FileBrowserProps) {
  const [mode, setMode] = useState<SidebarMode>('explorer')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [draftCreate, setDraftCreate] = useState<DraftCreate | null>(null)
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)
  const [clipboard, setClipboard] = useState<{ path: string; action: 'copy' | 'cut' } | null>(null)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const tree = useMemo(() => buildTree(files), [files])
  const fileMap = useMemo(() => {
    const map = new Map<string, ProjectFileEntry>()
    for (const entry of files) map.set(entry.path, entry)
    return map
  }, [files])
  const activeEntry = activePath ? fileMap.get(activePath) ?? null : null
  const canDeleteActiveFile = Boolean(activeEntry && activeEntry.type === 'file')

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const f of files) {
        if (f.type === 'directory' && !f.path.includes('/')) {
          next.add(f.path)
        }
      }
      return next
    })
  }, [files])

  useEffect(() => {
    if (!draftCreate) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [draftCreate])

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const collapseAll = () => setExpanded(new Set())

  const resolveCreateParent = (): string => {
    if (!activePath) return ''
    const activeEntry = fileMap.get(activePath)
    if (activeEntry?.type === 'directory') return activePath
    return dirname(activePath)
  }

  const beginCreate = (kind: CreateKind) => {
    const parentPath = resolveCreateParent()
    if (parentPath) {
      setExpanded((prev) => {
        const next = new Set(prev)
        next.add(parentPath)
        return next
      })
    }
    setTimeout(() => {
      setMode('explorer')
      setDraftCreate({ kind, parentPath, value: '' })
    }, 10)
  }

  const cancelCreate = () => {
    setDraftCreate(null)
    setIsSubmittingCreate(false)
  }

  const submitCreate = async () => {
    if (!draftCreate || isSubmittingCreate) return

    const fullPath = joinPath(draftCreate.parentPath, draftCreate.value)
    if (!fullPath) {
      cancelCreate()
      return
    }

    setIsSubmittingCreate(true)
    try {
      if (draftCreate.kind === 'file') {
        await onCreateFile(fullPath)
      } else {
        await onCreateDirectory(fullPath)
      }
      setDraftCreate(null)
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  const renderCreateRow = (depth: number) => {
    if (!draftCreate) return null

    return (
      <div className="px-1 py-0.5" style={{ paddingLeft: `${8 + depth * 14}px` }}>
        <div className="flex h-[22px] items-center rounded border border-app-danger/60 bg-app-editor-bg px-1">
          {draftCreate.kind === 'directory' ? (
            <Folder className="mr-1.5 h-3.5 w-3.5 text-app-warning" />
          ) : (
            <FileText className="mr-1.5 h-3.5 w-3.5 text-app-primary" />
          )}
          <input
            ref={inputRef}
            value={draftCreate.value}
            disabled={isSubmittingCreate}
            onChange={(event) => setDraftCreate((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
            onBlur={submitCreate}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') {
                event.preventDefault()
                void submitCreate()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelCreate()
              }
            }}
            className="h-full w-full bg-transparent text-[13px] text-app-text outline-none"
            placeholder={draftCreate.kind === 'directory' ? 'folder-name' : 'file-name'}
          />
        </div>
      </div>
    )
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const isDir = node.type === 'directory'
    const isExpanded = expanded.has(node.path)
    const isActive = activePath === node.path
    const shouldRenderDraftInside =
      isDir && isExpanded && draftCreate && draftCreate.parentPath === node.path

    return (
      <div key={node.path}>
        <button
          type="button"
          onClick={() => (isDir ? toggle(node.path) : onOpenFile(node.path))}
          className={cn(
            'flex h-[22px] w-full items-center text-left text-[13px] leading-none',
            isActive
              ? 'bg-app-editor-selection text-app-text'
              : 'text-app-muted hover:bg-app-surface-2 hover:text-app-text'
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <span className="mr-1 flex h-4 w-4 items-center justify-center text-app-subtle">
            {isDir ? (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : (
              <span className="h-3 w-3" />
            )}
          </span>
          {isDir ? (
            <Folder className="mr-1.5 h-3.5 w-3.5 text-app-warning" />
          ) : (
            <FileText className="mr-1.5 h-3.5 w-3.5 text-app-primary" />
          )}
          <span className="truncate">{node.name}</span>
        </button>

        {shouldRenderDraftInside ? renderCreateRow(depth + 1) : null}
        {isDir && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <aside className="flex h-full flex-col border-r border-app-border bg-app-editor-bg text-app-muted">
      <div className="flex h-9 items-center border-b border-app-border px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-[4px] text-app-muted hover:bg-app-surface-2 hover:text-app-text"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52 border-app-border bg-app-surface-2 text-app-text">
            <DropdownMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => beginCreate('file')}>
              New File...
              <DropdownMenuShortcut className="text-app-muted">Ctrl+Alt+N</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => beginCreate('directory')}>
              New Folder...
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-app-border-strong" />
            <DropdownMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={onRefresh}>
              Refresh Explorer
            </DropdownMenuItem>
            <DropdownMenuItem
              className="focus:bg-app-surface-3 cursor-pointer"
              onSelect={() => {
                if (activeEntry?.type === 'file') {
                  onDeleteFile(activeEntry.path)
                }
              }}
              disabled={!canDeleteActiveFile}
            >
              Delete File
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-app-border-strong" />
            <DropdownMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={(e) => {
              e.preventDefault()
              if (onToggleTerminal) {
                onToggleTerminal()
              }
            }} disabled={!onToggleTerminal}>
              {isTerminalVisible ? 'Hide Terminal' : 'Show Terminal'}
              <DropdownMenuShortcut className="text-app-muted">Ctrl+`</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-2 flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode('explorer')}
            className={cn(
              'h-7 w-7 rounded-[4px] hover:bg-app-surface-2',
              mode === 'explorer' ? 'text-app-text' : 'text-app-subtle'
            )}
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode('search')}
            className={cn(
              'h-7 w-7 rounded-[4px] hover:bg-app-surface-2',
              mode === 'search' ? 'text-app-text' : 'text-app-subtle'
            )}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode('extensions')}
            className={cn(
              'h-7 w-7 rounded-[4px] hover:bg-app-surface-2',
              mode === 'extensions' ? 'text-app-text' : 'text-app-subtle'
            )}
          >
            <Boxes className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {mode === 'explorer' && (
        <>
          <div className="flex h-9 items-center justify-between border-b border-app-border px-2 text-[13px]">
            <div className="truncate font-semibold uppercase tracking-wide text-app-text" title={projectName}>
              {projectName}
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => beginCreate('file')}
                className="h-6 w-6 rounded-[4px] text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                title="New File"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => beginCreate('directory')}
                className="h-6 w-6 rounded-[4px] text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                title="New Folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="h-6 w-6 rounded-[4px] text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (activeEntry?.type === 'file') {
                    onDeleteFile(activeEntry.path)
                  }
                }}
                disabled={!canDeleteActiveFile}
                className="h-6 w-6 rounded-[4px] text-app-muted hover:bg-app-danger/20 hover:text-app-danger disabled:opacity-50"
                title="Delete Action"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={collapseAll}
                className="h-6 w-6 rounded-[4px] text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                title="Collapse All"
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <ScrollArea className="flex-1">
                <div className="py-1 min-h-full">
                  {draftCreate?.parentPath === '' ? renderCreateRow(0) : null}
                  {tree.map((node) => renderNode(node, 0))}
                </div>
              </ScrollArea>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64 border-app-border bg-app-surface-2 text-app-text">
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => beginCreate('file')}>
                <FilePlus2 className="mr-2 h-4 w-4 text-app-muted" />
                New File...
              </ContextMenuItem>
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => beginCreate('directory')}>
                <FolderPlus className="mr-2 h-4 w-4 text-app-muted" />
                New Folder...
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-app-border-strong" />
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => {
                if (activeEntry) setClipboard({ path: activeEntry.path, action: 'cut' })
              }} disabled={!activeEntry}>
                <Scissors className="mr-2 h-4 w-4 text-app-muted" />
                Cut
                <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => {
                if (activeEntry) setClipboard({ path: activeEntry.path, action: 'copy' })
              }} disabled={!activeEntry}>
                <Copy className="mr-2 h-4 w-4 text-app-muted" />
                Copy
                <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={async () => {
                if (!clipboard) return
                const currentDir = activeEntry?.type === 'directory' ? activeEntry.path : resolveCreateParent()
                const destPath = joinPath(currentDir, clipboard.path.split('/').pop() || '')

                try {
                  const { copyProjectFile, renameProjectFile } = await import('@/api/projects')
                  if (clipboard.action === 'copy') {
                    await copyProjectFile(projectId, clipboard.path, destPath)
                    toast.success('Pasted copy')
                  } else {
                    await renameProjectFile(projectId, clipboard.path, destPath)
                    toast.success('Moved successfully')
                    setClipboard(null)
                  }
                  onRefresh()
                } catch (err: any) {
                  toast.error(err.message || 'Failed to paste')
                }
              }} disabled={!clipboard}>
                <ClipboardPaste className="mr-2 h-4 w-4 text-app-muted" />
                Paste
                <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-app-border-strong" />
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => {
                toast.info('Filename copied')
                activeEntry && navigator.clipboard.writeText(activeEntry.path)
              }} disabled={!activeEntry}>
                Copy Path
                <ContextMenuShortcut>Shift+Alt+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => {
                toast.info('Relative Path copied')
                activeEntry && navigator.clipboard.writeText(activeEntry.path)
              }} disabled={!activeEntry}>
                Copy Relative Path
                <ContextMenuShortcut>Ctrl+K Ctrl+Shift+C</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-app-border-strong" />
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={() => {
                if (!activeEntry) return
                const newName = window.prompt('Enter new name', activeEntry.name)
                if (!newName || newName === activeEntry.name) return

                const parentDir = dirname(activeEntry.path)
                const newPath = joinPath(parentDir, newName)

                import('@/api/projects').then(({ renameProjectFile }) => {
                  renameProjectFile(projectId, activeEntry.path, newPath)
                    .then(() => {
                      toast.success('Renamed successfully')
                      onRefresh()
                    })
                    .catch((err) => toast.error(err.message || 'Failed to rename'))
                })
              }} disabled={!activeEntry}>
                <Pencil className="mr-2 h-4 w-4 text-app-muted" />
                Rename...
                <ContextMenuShortcut>F2</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                className="focus:bg-app-surface-3 cursor-pointer text-app-danger focus:text-app-danger"
                onSelect={() => {
                  if (activeEntry?.type === 'file') {
                    onDeleteFile(activeEntry.path)
                  }
                }}
                disabled={!canDeleteActiveFile}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
                <ContextMenuShortcut className="text-app-danger">Shift+Delete</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-app-border-strong" />
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={(e) => {
                e.preventDefault()
                if (onToggleTerminal) {
                  onToggleTerminal()
                }
              }} disabled={!onToggleTerminal}>
                <TerminalIcon className="mr-2 h-4 w-4 text-app-muted" />
                Open In Integrated Terminal
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-app-border-strong" />
              <ContextMenuItem className="focus:bg-app-surface-3 cursor-pointer" onSelect={async () => {
                if (!activeEntry || activeEntry.type === 'directory') return
                try {
                  const { downloadProjectArchive } = await import('@/api/projects')
                  toast.info('Preparing download...')
                  await downloadProjectArchive(projectId, `${projectName}-${activeEntry.name}`)
                } catch (err: any) {
                  toast.error(err.message || 'Failed to download file')
                }
              }} disabled={!activeEntry || activeEntry.type === 'directory'}>
                <Download className="mr-2 h-4 w-4 text-app-muted" />
                Download
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </>
      )}

      {mode === 'search' && (
        <div className="flex flex-1 flex-col border-t border-app-border p-2">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-app-text">Search</div>
          <input
            placeholder="Search"
            className="h-8 rounded border border-app-primary/70 bg-app-editor-bg px-2 text-[13px] text-app-text outline-none"
          />
          <input
            placeholder="Replace"
            className="mt-2 h-8 rounded border border-app-border bg-app-editor-bg px-2 text-[13px] text-app-muted outline-none"
          />
        </div>
      )}

      {mode === 'extensions' && (
        <div className="flex flex-1 items-center justify-center text-xs text-app-subtle">
          Extensions view coming soon
        </div>
      )}
    </aside>
  )
}
