import { createApiRequest } from '@/utils/api'
import type { Project, CreateProjectInput } from '@/types'

export async function listProjects(): Promise<Project[]> {
  return createApiRequest<Project[]>('/projects', {
    method: 'GET',
  })
}

export async function getProject(id: string): Promise<Project> {
  return createApiRequest<Project>(`/projects/${id}`, {
    method: 'GET',
  })
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  return createApiRequest<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deleteProject(id: string): Promise<void> {
  return createApiRequest<void>(`/projects/${id}`, {
    method: 'DELETE',
  })
}

export async function startProject(id: string): Promise<Project> {
  return createApiRequest<Project>(`/projects/${id}/start`, {
    method: 'POST',
  })
}

export async function stopProject(id: string): Promise<Project> {
  return createApiRequest<Project>(`/projects/${id}/stop`, {
    method: 'POST',
  })
}

export async function getProjectStatus(id: string): Promise<Project> {
  return createApiRequest<Project>(`/projects/${id}/status`, {
    method: 'GET',
  })
}

export interface ProjectFileEntry {
  path: string
  name: string
  type: 'file' | 'directory'
}

export async function listProjectFiles(projectId: string): Promise<ProjectFileEntry[]> {
  const response = await createApiRequest<{ files: ProjectFileEntry[] }>(
    `/projects/${projectId}/files`,
    {
      method: 'GET',
    }
  )
  return response.files
}

export async function readProjectFile(
  projectId: string,
  path: string
): Promise<{ path: string; name: string; content: string }> {
  const query = new URLSearchParams({ path }).toString()
  return createApiRequest<{ path: string; name: string; content: string }>(
    `/projects/${projectId}/files/content?${query}`,
    {
      method: 'GET',
    }
  )
}

export async function saveProjectFile(
  projectId: string,
  path: string,
  content: string
): Promise<{ path: string; saved: boolean }> {
  return createApiRequest<{ path: string; saved: boolean }>(
    `/projects/${projectId}/files/content`,
    {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }
  )
}

export async function createProjectDirectory(
  projectId: string,
  path: string
): Promise<{ path: string; created: boolean }> {
  return createApiRequest<{ path: string; created: boolean }>(
    `/projects/${projectId}/files/directory`,
    {
      method: 'POST',
      body: JSON.stringify({ path }),
    }
  )
}

export async function deleteProjectFile(
  projectId: string,
  path: string
): Promise<{ path: string; deleted: boolean }> {
  const query = new URLSearchParams({ path }).toString()
  return createApiRequest<{ path: string; deleted: boolean }>(
    `/projects/${projectId}/files/content?${query}`,
    {
      method: 'DELETE',
    }
  )
}

export async function renameProjectFile(
  projectId: string,
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; oldPath: string; newPath: string }> {
  return createApiRequest<{ success: boolean; oldPath: string; newPath: string }>(
    `/projects/${projectId}/files/rename`,
    {
      method: 'POST',
      body: JSON.stringify({ oldPath, newPath }),
    }
  )
}

export async function copyProjectFile(
  projectId: string,
  srcPath: string,
  destPath: string
): Promise<{ success: boolean; srcPath: string; destPath: string }> {
  return createApiRequest<{ success: boolean; srcPath: string; destPath: string }>(
    `/projects/${projectId}/files/copy`,
    {
      method: 'POST',
      body: JSON.stringify({ srcPath, destPath }),
    }
  )
}

export async function downloadProjectArchive(
  projectId: string,
  projectName: string
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006'}/projects/${projectId}/download`
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName.replace(/[^a-zA-Z0-9-]/g, '_')}.zip`
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export async function downloadProjectFile(
  projectId: string,
  path: string,
  fileName: string
): Promise<void> {
  const urlParams = new URLSearchParams({ path })
  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006'}/projects/${projectId}/file/download?${urlParams.toString()}`
  
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.replace(/[^a-zA-Z0-9-.]/g, '_')
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
