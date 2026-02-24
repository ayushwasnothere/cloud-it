import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { prisma } from '../../db';
import { ContainerManager, getProjectWorkspacePath } from '../../services/docker';
import { checkRateLimit } from '../../services/rateLimiter';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';

const ALLOWED_RUNTIMES = new Set(['node', 'python', 'bun']);

type ProjectRecord = {
  id: string;
  name: string;
  runtime: string;
  createdAt: Date;
  updatedAt: Date;
};

function toProjectStatus(running: boolean) {
  return running ? 'running' : 'stopped';
}

async function attachRuntimeStatus(project: ProjectRecord) {
  const containerStatus = await ContainerManager.getStatus(project.id);
  return {
    ...project,
    status: toProjectStatus(containerStatus.running),
  };
}

function resolveProjectPath(workspacePath: string, inputPath: string): string {
  const trimmed = inputPath.trim();
  if (!trimmed) throw new Error('Path is required');
  if (trimmed.includes('\0')) throw new Error('Invalid path');

  const relativePath = trimmed.replace(/^\/+/, '');
  const resolvedPath = resolve(workspacePath, relativePath);

  if (resolvedPath !== workspacePath && !resolvedPath.startsWith(workspacePath + sep)) {
    throw new Error('Path traversal detected');
  }

  return resolvedPath;
}

async function listWorkspaceFiles(workspacePath: string, dirPath = workspacePath): Promise<Array<{ path: string; name: string; type: 'file' | 'directory' }>> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results: Array<{ path: string; name: string; type: 'file' | 'directory' }> = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;

    const absPath = resolve(dirPath, entry.name);
    const relPath = relative(workspacePath, absPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      results.push({
        path: relPath,
        name: entry.name,
        type: 'directory',
      });
      const nested = await listWorkspaceFiles(workspacePath, absPath);
      results.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      results.push({
        path: relPath,
        name: entry.name,
        type: 'file',
      });
    }
  }

  return results;
}

async function seedProjectTemplate(
  workspacePath: string,
  runtime: string,
  projectName: string
) {
  const existing = await readdir(workspacePath).catch(() => []);
  if (existing.length > 0) return;

  const templates: Record<string, Array<{ path: string; content: string }>> = {
    node: [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            private: true,
            version: '0.1.0',
            type: 'module',
            scripts: {
              dev: 'node --watch src/index.js',
              start: 'node src/index.js',
              test: 'node --test',
            },
          },
          null,
          2
        ),
      },
      {
        path: 'src/index.js',
        content:
          "import http from 'node:http';\n\nconst port = process.env.PORT || 3000;\n\nhttp.createServer((_, res) => {\n  res.writeHead(200, { 'Content-Type': 'application/json' });\n  res.end(JSON.stringify({ ok: true, runtime: 'node' }));\n}).listen(port, () => {\n  console.log(`Server running on http://localhost:${port}`);\n});\n",
      },
      { path: '.gitignore', content: 'node_modules/\n.env\n' },
      {
        path: 'README.md',
        content: `# ${projectName}\n\nNode.js starter template.\n`,
      },
    ],
    python: [
      {
        path: 'main.py',
        content:
          "from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get('/')\ndef root():\n    return {'ok': True, 'runtime': 'python'}\n",
      },
      { path: 'requirements.txt', content: 'fastapi==0.116.1\nuvicorn==0.35.0\n' },
      { path: '.gitignore', content: '__pycache__/\n.venv/\n.env\n' },
      {
        path: 'README.md',
        content:
          `# ${projectName}\n\nPython starter template.\n\nRun:\n` +
          '```bash\npip install -r requirements.txt\nuvicorn main:app --reload --host 0.0.0.0 --port 3000\n```\n',
      },
    ],
    bun: [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            private: true,
            version: '0.1.0',
            scripts: {
              dev: 'bun --watch src/index.ts',
              start: 'bun src/index.ts',
              test: 'bun test',
            },
          },
          null,
          2
        ),
      },
      {
        path: 'src/index.ts',
        content:
          "Bun.serve({\n  port: Number(process.env.PORT || 3000),\n  fetch() {\n    return Response.json({ ok: true, runtime: 'bun' })\n  },\n})\n\nconsole.log('Bun server running')\n",
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              target: 'ESNext',
              module: 'ESNext',
              moduleResolution: 'Bundler',
              strict: true,
              types: ['bun-types'],
            },
          },
          null,
          2
        ),
      },
      { path: '.gitignore', content: '.env\nnode_modules/\n' },
      {
        path: 'README.md',
        content: `# ${projectName}\n\nBun starter template.\n`,
      },
    ],
  };

  const files = templates[runtime] ?? templates.node;
  for (const file of files) {
    const absolutePath = resolve(workspacePath, file.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.content, 'utf8');
  }
}

const runtimeRoutes = new Elysia({ prefix: '/projects' })
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET || 'super-secret' }))
  .derive(async ({ jwt: jwtPlugin, cookie }) => {
    const token = cookie.token?.value;
    if (!token || typeof token !== 'string') return { userId: null };
    try {
      const payload = await jwtPlugin.verify(token) as any;
      return { userId: payload?.id ?? null };
    } catch {
      return { userId: null };
    }
  })

  .post(
    '/',
    async ({ body, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });
      if (!ALLOWED_RUNTIMES.has(body.runtime)) return new Response('Invalid runtime', { status: 400 });

      const project = await prisma.projects.create({
        data: { name: body.name, runtime: body.runtime, userId },
        select: { id: true, name: true, runtime: true, createdAt: true, updatedAt: true },
      });

      const workspacePath = getProjectWorkspacePath(project.id);
      await mkdir(workspacePath, { recursive: true });
      await seedProjectTemplate(workspacePath, project.runtime, project.name);

      return {
        ...project,
        status: 'stopped',
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        runtime: t.Union([t.Literal('node'), t.Literal('python'), t.Literal('bun')]),
      }),
    }
  )

  .get('/', async ({ userId }) => {
    if (!userId) return new Response('Unauthorized', { status: 401 });
    if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

    const projects = await prisma.projects.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, runtime: true, createdAt: true, updatedAt: true },
    });

    return Promise.all(projects.map((project) => attachRuntimeStatus(project)));
  })

  .get(
    '/:projectId',
    async ({ params, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true, name: true, runtime: true, createdAt: true, updatedAt: true },
      });

      if (!project) return new Response('Project not found', { status: 404 });

      return attachRuntimeStatus(project);
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    }
  )

  .delete(
    '/:projectId',
    async ({ params, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
      });

      if (!project) return new Response('Not found', { status: 404 });

      await prisma.projects.delete({ where: { id: params.projectId } });

      try {
        await ContainerManager.removeContainer(params.projectId);
      } catch (err: any) {
        console.error(`[delete] Container removal failed for ${params.projectId}:`, err.message);
      }

      return { status: 'deleted' };
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    }
  )

  .post(
    '/:projectId/start',
    async ({ params, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true, name: true, runtime: true, createdAt: true, updatedAt: true },
      });

      if (!project) return new Response('Project not found', { status: 404 });

      await ContainerManager.getOrCreateContainer(params.projectId, project.runtime);
      return attachRuntimeStatus(project);
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    }
  )

  .post(
    '/:projectId/stop',
    async ({ params, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true, name: true, runtime: true, createdAt: true, updatedAt: true },
      });

      if (!project) return new Response('Project not found', { status: 404 });

      await ContainerManager.stopContainer(params.projectId);
      return {
        ...project,
        status: 'stopped',
      };
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    }
  )

  .get(
    '/:projectId/status',
    async ({ params, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
      });

      if (!project) return new Response('Project not found', { status: 404 });

      const status = await ContainerManager.getStatus(params.projectId);
      return {
        ...status,
        status: toProjectStatus(status.running),
      };
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    }
  )

  .get(
    '/:projectId/files',
    async ({ params, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true },
      });
      if (!project) return new Response('Project not found', { status: 404 });

      const workspacePath = getProjectWorkspacePath(project.id);
      await mkdir(workspacePath, { recursive: true });

      const files = await listWorkspaceFiles(workspacePath);
      files.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.path.localeCompare(b.path);
      });

      return { files };
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    }
  )

  .get(
    '/:projectId/files/content',
    async ({ params, query, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true },
      });
      if (!project) return new Response('Project not found', { status: 404 });

      const requestedPath = typeof query.path === 'string' ? query.path : '';
      const workspacePath = getProjectWorkspacePath(project.id);
      const filePath = resolveProjectPath(workspacePath, requestedPath);

      const info = await stat(filePath).catch(() => null);
      if (!info || !info.isFile()) return new Response('File not found', { status: 404 });

      const content = await readFile(filePath, 'utf8');
      return {
        path: requestedPath.replace(/^\/+/, ''),
        name: basename(filePath),
        content,
      };
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
      query: t.Object({ path: t.String() }),
    }
  )

  .put(
    '/:projectId/files/content',
    async ({ params, body, userId }) => {
      if (!userId) return new Response('Unauthorized', { status: 401 });
      if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true },
      });
      if (!project) return new Response('Project not found', { status: 404 });

      const normalizedPath = body.path.trim().replace(/^\/+/, '');
      if (!normalizedPath || normalizedPath.endsWith('/')) {
        return new Response('Invalid file path', { status: 400 });
      }

      const workspacePath = getProjectWorkspacePath(project.id);
      await mkdir(workspacePath, { recursive: true });

      const filePath = resolveProjectPath(workspacePath, normalizedPath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, body.content, 'utf8');

      return {
        path: normalizedPath,
        saved: true,
      };
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
      body: t.Object({
        path: t.String({ minLength: 1 }),
        content: t.String(),
      }),
    }
  );

runtimeRoutes.post(
  '/:projectId/files/directory',
  async ({ params, body, userId }) => {
    if (!userId) return new Response('Unauthorized', { status: 401 });
    if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

    const project = await prisma.projects.findFirst({
      where: { id: params.projectId, userId },
      select: { id: true },
    });
    if (!project) return new Response('Project not found', { status: 404 });

    const normalizedPath = body.path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!normalizedPath) {
      return new Response('Invalid directory path', { status: 400 });
    }

    const workspacePath = getProjectWorkspacePath(project.id);
    await mkdir(workspacePath, { recursive: true });

    const dirPath = resolveProjectPath(workspacePath, normalizedPath);
    await mkdir(dirPath, { recursive: true });

    return {
      path: normalizedPath,
      created: true,
    };
  },
  {
    params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    body: t.Object({
      path: t.String({ minLength: 1 }),
    }),
  }
);

runtimeRoutes.delete(
  '/:projectId/files/content',
  async ({ params, query, userId }) => {
    if (!userId) return new Response('Unauthorized', { status: 401 });
    if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

    const project = await prisma.projects.findFirst({
      where: { id: params.projectId, userId },
      select: { id: true },
    });
    if (!project) return new Response('Project not found', { status: 404 });

    const requestedPath = typeof query.path === 'string' ? query.path : '';
    const normalizedPath = requestedPath.trim().replace(/^\/+/, '');
    if (!normalizedPath || normalizedPath.endsWith('/')) {
      return new Response('Invalid file path', { status: 400 });
    }

    const workspacePath = getProjectWorkspacePath(project.id);
    const filePath = resolveProjectPath(workspacePath, normalizedPath);
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      return new Response('File not found', { status: 404 });
    }

    await unlink(filePath);
    return {
      path: normalizedPath,
      deleted: true,
    };
  },
  {
    params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    query: t.Object({ path: t.String({ minLength: 1 }) }),
  }
);

export default runtimeRoutes;
