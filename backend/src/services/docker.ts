import Docker from 'dockerode';
import { join, normalize } from 'node:path';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';

const DOCKER_SOCKET_PATH = '/var/run/docker.sock';
export const docker = new Docker({
  socketPath: DOCKER_SOCKET_PATH,
});

const WORKSPACE_BASE = join(import.meta.dir, '../../workspaces');

const ALLOWED_RUNTIMES = new Set(['node', 'python', 'bun']);
const lastUsedMap = new Map<string, number>();

// Prevent concurrent getOrCreateContainer calls for the same project
const creationLocks = new Map<string, Promise<Docker.Container>>();

const MEMORY_LIMIT = 512 * 1024 * 1024;
const CPU_LIMIT = 1_000_000_000;
const PID_LIMIT = 128;
const IDLE_TIMEOUT = 30 * 60 * 1000;
const SANDBOX_NETWORK_MODE = process.env.SANDBOX_NETWORK_MODE || 'bridge';
const ALLOWED_NETWORK_MODES = new Set(['none', 'bridge', 'host']);
const SANDBOX_PREVIEW_PORT = Number(process.env.SANDBOX_PREVIEW_PORT || 3000);
const PREVIEW_PORT_KEY = `${SANDBOX_PREVIEW_PORT}/tcp`;

// Strict UUID v4 pattern — projectId must match before use in any path or name
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertSafeProjectId(projectId: string): void {
  if (!UUID_RE.test(projectId)) {
    throw new Error(`Invalid projectId: ${projectId}`);
  }
}

function getPublishedPreviewPort(info: Docker.ContainerInspectInfo): string | null {
  const bindings = info.NetworkSettings?.Ports?.[PREVIEW_PORT_KEY];
  if (!bindings || bindings.length === 0) return null;
  return bindings[0]?.HostPort || null;
}

function hasEnvValue(info: Docker.ContainerInspectInfo, expected: string): boolean {
  return (info.Config?.Env ?? []).includes(expected);
}

function requiresContainerRecreate(info: Docker.ContainerInspectInfo): boolean {
  if (info.HostConfig?.NetworkMode !== SANDBOX_NETWORK_MODE) return true;
  if (!hasEnvValue(info, 'HOME=/home/sandbox/app')) return true;
  if (!hasEnvValue(info, 'PIP_CACHE_DIR=/home/sandbox/app/.cache/pip')) return true;
  if (!hasEnvValue(info, 'PATH=/home/sandbox/app/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin')) return true;
  return getPublishedPreviewPort(info) === null;
}

function containerName(projectId: string) {
  return `replit-${projectId}`;
}

function safeWorkspacePath(projectId: string): string {
  assertSafeProjectId(projectId);
  const resolved = normalize(join(WORKSPACE_BASE, projectId));
  // Ensure the resolved path is still under WORKSPACE_BASE (prevent traversal)
  if (!resolved.startsWith(WORKSPACE_BASE + '/') && resolved !== WORKSPACE_BASE) {
    throw new Error(`Path traversal attempt detected for projectId: ${projectId}`);
  }
  return resolved;
}

export function getProjectWorkspacePath(projectId: string): string {
  return safeWorkspacePath(projectId);
}

async function assertDockerSocketAccessible() {
  try {
    await access(DOCKER_SOCKET_PATH, fsConstants.R_OK | fsConstants.W_OK);
  } catch {
    throw new Error(
      `Docker socket ${DOCKER_SOCKET_PATH} is not accessible. ` +
      `Add this user to the docker group (or run with equivalent permissions), then restart the backend.`
    );
  }
}

async function _getOrCreateContainer(projectId: string, runtime: string): Promise<Docker.Container> {
  assertSafeProjectId(projectId);
  await assertDockerSocketAccessible();

  if (!ALLOWED_RUNTIMES.has(runtime)) {
    throw new Error(`Invalid runtime: ${runtime}`);
  }
  if (!ALLOWED_NETWORK_MODES.has(SANDBOX_NETWORK_MODE)) {
    throw new Error(
      `Invalid SANDBOX_NETWORK_MODE: ${SANDBOX_NETWORK_MODE}. Allowed values: none, bridge, host`
    );
  }
  if (!Number.isInteger(SANDBOX_PREVIEW_PORT) || SANDBOX_PREVIEW_PORT < 1 || SANDBOX_PREVIEW_PORT > 65535) {
    throw new Error(
      `Invalid SANDBOX_PREVIEW_PORT: ${process.env.SANDBOX_PREVIEW_PORT}. Must be an integer between 1 and 65535`
    );
  }

  const name = containerName(projectId);
  const hostPath = safeWorkspacePath(projectId);

  await mkdir(hostPath, { recursive: true });

  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();

    if (requiresContainerRecreate(info)) {
      if (info.State.Running) {
        await container.stop({ t: 5 });
      }
      await container.remove({ force: true });
      throw Object.assign(new Error('Recreating container due to runtime config change'), { statusCode: 404 });
    }

    if (!info.State.Running) {
      await container.start();
    }

    ContainerManager.markUsed(projectId);
    return container;
  } catch (err: any) {
    if (err.statusCode !== 404) throw err;

    const container = await docker.createContainer({
      Image: `sandbox-${runtime}`,
      name,
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      WorkingDir: '/home/sandbox/app',
      User: 'sandbox',
      Env: [
        'HOME=/home/sandbox/app',
        'PWD=/home/sandbox/app',
        'PIP_CACHE_DIR=/home/sandbox/app/.cache/pip',
        'PATH=/home/sandbox/app/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      ],
      Cmd: ['/bin/sh', '-i'],
      ExposedPorts: { [PREVIEW_PORT_KEY]: {} },
      HostConfig: {
        Binds: [`${hostPath}:/home/sandbox/app:Z`],
        Memory: MEMORY_LIMIT,
        NanoCpus: CPU_LIMIT,
        PidsLimit: PID_LIMIT,
        ReadonlyRootfs: true,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Tmpfs: { '/tmp': 'size=64m' },
        NetworkMode: SANDBOX_NETWORK_MODE,
        PortBindings: {
          [PREVIEW_PORT_KEY]: [{ HostIp: '127.0.0.1', HostPort: '' }],
        },
        AutoRemove: false,
      },
    });

    await container.start();
    ContainerManager.markUsed(projectId);
    return container;
  }
}

export const ContainerManager = {
  // Serializes concurrent calls for the same projectId to prevent
  // race conditions that would cause duplicate container creation
  async getOrCreateContainer(projectId: string, runtime: string): Promise<Docker.Container> {
    const existing = creationLocks.get(projectId);
    if (existing) return existing;

    const promise = _getOrCreateContainer(projectId, runtime).finally(() => {
      creationLocks.delete(projectId);
    });

    creationLocks.set(projectId, promise);
    return promise;
  },

  async stopContainer(projectId: string) {
    assertSafeProjectId(projectId);
    await assertDockerSocketAccessible();
    const name = containerName(projectId);
    try {
      const container = docker.getContainer(name);
      await container.stop({ t: 5 });
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;
    } finally {
      // Always clean up tracking, even if stop failed
      lastUsedMap.delete(projectId);
    }
  },

  async removeContainer(projectId: string) {
    assertSafeProjectId(projectId);
    await assertDockerSocketAccessible();
    const name = containerName(projectId);
    try {
      const container = docker.getContainer(name);
      await container.remove({ force: true });
    } catch (err: any) {
      if (err.statusCode !== 404) throw err;
    } finally {
      // Always clean up tracking maps regardless of Docker errors
      lastUsedMap.delete(projectId);
      creationLocks.delete(projectId);
    }
  },

  async getStatus(projectId: string) {
    assertSafeProjectId(projectId);
    await assertDockerSocketAccessible();
    const name = containerName(projectId);
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();
      return { exists: true, running: info.State.Running };
    } catch (err: any) {
      if (err.statusCode === 404) return { exists: false, running: false };
      throw err;
    }
  },

  async getPreview(projectId: string) {
    assertSafeProjectId(projectId);
    await assertDockerSocketAccessible();
    const name = containerName(projectId);
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();

      if (!info.State.Running) {
        return { available: false, url: null, port: SANDBOX_PREVIEW_PORT, hostPort: null };
      }

      const hostPort = getPublishedPreviewPort(info);
      if (!hostPort) {
        return { available: false, url: null, port: SANDBOX_PREVIEW_PORT, hostPort: null };
      }

      return {
        available: true,
        url: `http://127.0.0.1:${hostPort}`,
        port: SANDBOX_PREVIEW_PORT,
        hostPort: Number(hostPort),
      };
    } catch (err: any) {
      if (err.statusCode === 404) {
        return { available: false, url: null, port: SANDBOX_PREVIEW_PORT, hostPort: null };
      }
      throw err;
    }
  },

  markUsed(projectId: string) {
    lastUsedMap.set(projectId, Date.now());
  },
};

// Idle container reaper
setInterval(async () => {
  const now = Date.now();
  for (const [projectId, lastUsed] of lastUsedMap.entries()) {
    if (now - lastUsed > IDLE_TIMEOUT) {
      const name = containerName(projectId);
      try {
        const container = docker.getContainer(name);
        await container.stop({ t: 5 });
        lastUsedMap.delete(projectId);
        console.log(`[reaper] Stopped idle container: ${name}`);
      } catch (err: any) {
        if (err.statusCode === 404) {
          // Container already gone — clean up tracking
          lastUsedMap.delete(projectId);
        } else {
          console.error(`[reaper] Failed to stop ${name}:`, err.message);
        }
      }
    }
  }
}, 60_000);
