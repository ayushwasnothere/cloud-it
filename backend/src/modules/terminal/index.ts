import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ContainerManager } from '../../services/docker';
import { prisma } from '../../db';
import * as net from 'node:net';

// ws.id → Docker socket
const sessionMap = new Map<string, net.Socket>();

// projectId → Set of ws.ids (track which sessions belong to which project)
const projectSessions = new Map<string, Set<string>>();

const MAX_SESSIONS_PER_PROJECT = 3;
const MAX_SESSIONS_PER_USER = 5;
const WS_HEARTBEAT_PAYLOAD = '__v0_ping__';

// userId → Set of ws.ids (enforce per-user session cap too)
const userSessions = new Map<string, Set<string>>();

/**
 * Attach to a running container's stdio via raw TCP on the Docker Unix socket.
 * Bypasses node:http entirely — Bun has a confirmed bug where HTTP connection
 * upgrades (hijack mode) hang or segfault. node:net works correctly.
 */
function dockerAttach(containerId: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection('/var/run/docker.sock');
    const query = 'stream=1&stdin=1&stdout=1&stderr=1';
    const request = [
      `POST /containers/${containerId}/attach?${query} HTTP/1.1`,
      `Host: localhost`,
      `Content-Type: application/json`,
      `Connection: Upgrade`,
      `Upgrade: tcp`,
      `\r\n`,
    ].join('\r\n');

    let headerBuf = '';
    let resolved = false;
    let headerDone = false;

    socket.on('connect', () => socket.write(request));

    socket.on('data', (chunk: Buffer) => {
      if (headerDone) return;

      headerBuf += chunk.toString('binary');
      const headerEnd = headerBuf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      headerDone = true;
      const statusCode = parseInt(headerBuf.split('\r\n')[0].split(' ')[1]);

      if (statusCode === 101) {
        const leftover = Buffer.from(headerBuf.slice(headerEnd + 4), 'binary');
        if (leftover.length > 0) socket.unshift(leftover);
        socket.removeAllListeners('data');
        resolved = true;
        resolve(socket);
      } else {
        reject(new Error(`Docker attach failed: HTTP ${statusCode}`));
        socket.destroy();
      }
    });

    socket.on('error', (err) => { if (!resolved) reject(err); });
    socket.on('close', () => { if (!resolved) reject(new Error('Socket closed before upgrade')); });
  });
}

function cleanupSession(wsId: string, projectId?: string, userId?: string) {
  const socket = sessionMap.get(wsId);
  if (socket) {
    try { socket.destroy(); } catch {}
    sessionMap.delete(wsId);
  }

  if (projectId) {
    const set = projectSessions.get(projectId);
    if (set) {
      set.delete(wsId);
      if (set.size === 0) projectSessions.delete(projectId);
    }
  }

  if (userId) {
    const set = userSessions.get(userId);
    if (set) {
      set.delete(wsId);
      if (set.size === 0) userSessions.delete(userId);
    }
  }
}

const ws = new Elysia({ prefix: '/terminal' })
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET || 'super-secret' }))
  .derive(async ({ jwt: jwtPlugin, cookie, query }) => {
    let token = cookie.token?.value;
    if (!token && typeof query.token === 'string') token = query.token;
    if (!token) return { userId: null };
    try {
      const payload = (await jwtPlugin.verify(token as string)) as any;
      return { userId: payload?.id ?? null };
    } catch {
      return { userId: null };
    }
  })
  .ws('/:projectId', {
    params: t.Object({ projectId: t.String() }),

    async open(ws) {
      const { projectId } = ws.data.params;
      const userId = ws.data.userId as string | null;

      if (!userId) { ws.close(1008, 'Unauthorized'); return; }

      // Per-project session cap
      const projSet = projectSessions.get(projectId) ?? new Set();
      if (projSet.size >= MAX_SESSIONS_PER_PROJECT) {
        ws.close(1008, 'Too many terminal sessions for this project');
        return;
      }

      // Per-user session cap across all projects
      const userSet = userSessions.get(userId) ?? new Set();
      if (userSet.size >= MAX_SESSIONS_PER_USER) {
        ws.close(1008, 'Too many terminal sessions for this user');
        return;
      }

      const project = await prisma.projects.findFirst({
        where: { id: projectId, userId },
        select: { runtime: true },
      });

      if (!project) { ws.close(1008, 'Project not found'); return; }

      try {
        const container = await ContainerManager.getOrCreateContainer(projectId, project.runtime);
        const info = await container.inspect();

        if (!info.State.Running) {
          ws.close(1011, 'Container not running');
          return;
        }

        const dockerSocket = await dockerAttach(info.Id);
        let sessionClosed = false;
        const closeForShellExit = async () => {
          if (sessionClosed) return;
          sessionClosed = true;
          try {
            await ContainerManager.stopContainer(projectId);
          } catch {}
          try {
            ws.close(4000, 'Shell exited');
          } catch {}
        };

        // Container output → WebSocket
        dockerSocket.on('data', (chunk: Buffer) => {
          try { ws.send(chunk.toString('utf8')); } catch {}
        });

        dockerSocket.on('end', closeForShellExit);
        dockerSocket.on('close', closeForShellExit);
        dockerSocket.on('error', closeForShellExit);

        // Register session in both tracking maps
        sessionMap.set(ws.id, dockerSocket);

        projSet.add(ws.id);
        projectSessions.set(projectId, projSet);

        userSet.add(ws.id);
        userSessions.set(userId, userSet);

        ContainerManager.markUsed(projectId);

      } catch (err: any) {
        console.error(`[terminal] Attach failed: ${err.message}`);
        ws.close(1011, 'Terminal initialization failed');
      }
    },

    message(ws, msg: unknown) {
      const socket = sessionMap.get(ws.id);
      if (!socket?.writable || socket.destroyed) return;

      if (typeof msg === 'string' && msg === WS_HEARTBEAT_PAYLOAD) {
        return;
      }

      const data = typeof msg === 'string'
        ? Buffer.from(msg, 'utf8')
        : Buffer.from(msg as Uint8Array);

      try { socket.write(data); } catch {}
    },

    close(ws) {
      const projectId = ws.data?.params?.projectId;
      const userId = ws.data?.userId as string | undefined;
      cleanupSession(ws.id, projectId, userId);
    },
  });

export default ws;
