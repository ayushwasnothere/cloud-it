import { useEffect, useCallback, useRef } from 'react'
import { useProjectsStore } from '@/state/projectsStore'
import * as projectsApi from '@/api/projects'
import { PROJECT_POLL_INTERVAL, MAX_POLL_INTERVAL, BACKOFF_MULTIPLIER } from '@/utils/constants'
import type { CreateProjectInput } from '@/types'

export function useProjects(autoPoll = false) {
  const {
    projects,
    isLoading,
    error,
    setProjects,
    addProject,
    removeProject,
    updateProject,
    setLoading,
    setError,
  } = useProjectsStore()

  const pollIntervalRef = useRef(PROJECT_POLL_INTERVAL)
  const pollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await projectsApi.listProjects()
      setProjects(data || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      setProjects([])
      const message = err instanceof Error ? err.message : 'Failed to fetch projects'
      if (!message.includes('404') && !message.includes('not found')) {
        setError(message)
      } else {
        setError(null)
      }
    } finally {
      setLoading(false)
    }
  }, [setProjects, setLoading, setError])

  // Fetch projects on mount, then auto-poll if enabled
  useEffect(() => {
    let isMounted = true

    const fetchAndPoll = async () => {
      setLoading(true)
      try {
        const data = await projectsApi.listProjects()
        if (isMounted) {
          setProjects(data || [])
          pollIntervalRef.current = PROJECT_POLL_INTERVAL
          setError(null)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to fetch projects:', err)
        // Allow empty projects list, don't error
        setProjects([])
        // Only set error if it's not a 404 (endpoint not implemented)
        const message = err instanceof Error ? err.message : 'Failed to fetch projects'
        if (!message.includes('404') && !message.includes('not found')) {
          setError(message)
        } else {
          setError(null)
        }

        // Implement exponential backoff on error
        pollIntervalRef.current = Math.min(
          pollIntervalRef.current * BACKOFF_MULTIPLIER,
          MAX_POLL_INTERVAL
        )
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }

      // Schedule next poll if enabled
      if (isMounted && autoPoll) {
        pollTimeoutRef.current = setTimeout(fetchAndPoll, pollIntervalRef.current)
      }
    }

    fetchAndPoll()

    return () => {
      isMounted = false
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [autoPoll])

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      setLoading(true)
      setError(null)
      try {
        const project = await projectsApi.createProject(input)
        addProject(project)
        return project
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create project'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [addProject, setLoading, setError]
  )

  const deleteProject = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        await projectsApi.deleteProject(id)
        removeProject(id)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete project'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [removeProject, setLoading, setError]
  )

  const startProject = useCallback(
    async (id: string) => {
      setError(null)
      try {
        const project = await projectsApi.startProject(id)
        updateProject(id, project)
        return project
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start project'
        setError(message)
        throw err
      }
    },
    [updateProject, setError]
  )

  const stopProject = useCallback(
    async (id: string) => {
      setError(null)
      try {
        const project = await projectsApi.stopProject(id)
        updateProject(id, project)
        return project
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to stop project'
        setError(message)
        throw err
      }
    },
    [updateProject, setError]
  )

  return {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    deleteProject,
    startProject,
    stopProject,
  }
}
