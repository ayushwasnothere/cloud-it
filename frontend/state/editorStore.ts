import { create } from 'zustand'
import type { EditorFile, EditorTab } from '@/types'

interface EditorStore {
  tabs: EditorTab[]
  activeTabId: string | null
  files: Record<string, EditorFile>
  isLoading: boolean
  error: string | null

  addTab: (tab: EditorTab, file: EditorFile) => void
  removeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateFile: (fileId: string, content: string) => void
  markFileSaved: (fileId: string) => void
  markFileModified: (fileId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  tabs: [],
  activeTabId: null,
  files: {},
  isLoading: false,
  error: null,

  addTab: (tab, file) =>
    set((state) => {
      const tabs = state.tabs.find((t) => t.id === tab.id)
        ? state.tabs
        : [...state.tabs, tab]

      return {
        tabs,
        activeTabId: tab.id,
        files: {
          ...state.files,
          [file.id]: file,
        },
      }
    }),

  removeTab: (tabId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId)
      const fileId = state.tabs.find((t) => t.id === tabId)?.fileId
      const newFiles = { ...state.files }
      if (fileId) delete newFiles[fileId]

      return {
        tabs: newTabs,
        activeTabId:
          state.activeTabId === tabId
            ? newTabs[0]?.id ?? null
            : state.activeTabId,
        files: newFiles,
      }
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateFile: (fileId, content) =>
    set((state) => {
      const file = state.files[fileId]
      if (!file) return state

      return {
        files: {
          ...state.files,
          [fileId]: {
            ...file,
            content,
            isSaved: false,
          },
        },
        tabs: state.tabs.map((t) =>
          t.fileId === fileId ? { ...t, isDirty: true } : t
        ),
      }
    }),

  markFileSaved: (fileId) =>
    set((state) => ({
      files: {
        ...state.files,
        [fileId]: {
          ...state.files[fileId],
          isSaved: true,
        },
      },
      tabs: state.tabs.map((t) =>
        t.fileId === fileId ? { ...t, isDirty: false } : t
      ),
    })),

  markFileModified: (fileId) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.fileId === fileId ? { ...t, isDirty: true } : t
      ),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      tabs: [],
      activeTabId: null,
      files: {},
      isLoading: false,
      error: null,
    }),
}))
