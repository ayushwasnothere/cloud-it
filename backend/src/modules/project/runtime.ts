import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { prisma } from '../../db';
import { ContainerManager, getProjectWorkspacePath } from '../../services/docker';
import { checkRateLimit } from '../../services/rateLimiter';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { $ } from 'bun';

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
  const preview = await ContainerManager.getPreview(project.id);
  return {
    ...project,
    status: toProjectStatus(containerStatus.running),
    preview,
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
  const packageName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '') || 'repl-app';

  const templates: Record<string, Array<{ path: string; content: string }>> = {
    node: [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: packageName,
            private: true,
            version: '0.1.0',
            type: 'module',
            scripts: {
              dev: 'node --watch src/index.js',
              start: 'node src/index.js',
              test: 'node --test',
            },
            engines: {
              node: '>=20',
            },
          },
          null,
          2
        ),
      },
      {
        path: 'src/index.js',
        content:
          "import http from 'node:http';\n\nconst port = Number(process.env.PORT || 3000);\n\nconst server = http.createServer((req, res) => {\n  res.setHeader('Content-Type', 'application/json');\n\n  if (req.url === '/health') {\n    res.writeHead(200);\n    res.end(JSON.stringify({ ok: true, runtime: 'node', status: 'healthy' }));\n    return;\n  }\n\n  res.writeHead(200);\n  res.end(\n    JSON.stringify({\n      ok: true,\n      runtime: 'node',\n      message: 'Welcome to your Node starter',\n      docs: ['/health'],\n      time: new Date().toISOString(),\n    })\n  );\n});\n\nserver.listen(port, '0.0.0.0', () => {\n  console.log(`Node server running on http://0.0.0.0:${port}`);\n});\n",
      },
      {
        path: '.replit',
        content:
          'entrypoint = "src/index.js"\n' +
          'run = "npm install && npm run dev"\n',
      },
      {
        path: '.gitignore',
        content: 'node_modules/\n.env\n.env.*\nnpm-debug.log*\n',
      },
      {
        path: '.env.example',
        content: 'PORT=3000\n',
      },
      {
        path: 'README.md',
        content:
          `# ${projectName}\n\n` +
          'Node.js starter template with a basic HTTP API.\n\n' +
          '## Quick start\n\n' +
          '```bash\nnpm install\nnpm run dev\n```\n\n' +
          'Open `http://localhost:3000`.\n',
      },
    ],
    python: [
      {
        path: 'main.py',
        content:
          "from fastapi import FastAPI\n\napp = FastAPI(title='Python Starter')\n\n\n@app.get('/')\ndef root() -> dict[str, object]:\n    return {\n        'ok': True,\n        'runtime': 'python',\n        'message': 'Welcome to your FastAPI starter',\n    }\n\n\n@app.get('/health')\ndef health() -> dict[str, object]:\n    return {'ok': True, 'status': 'healthy'}\n",
      },
      {
        path: '.replit',
        content:
          'entrypoint = "main.py"\n' +
          'run = "python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port ${PORT:-3000} --reload"\n',
      },
      {
        path: 'requirements.txt',
        content: 'fastapi==0.116.1\nuvicorn[standard]==0.35.0\n',
      },
      {
        path: '.gitignore',
        content: '__pycache__/\n.pytest_cache/\n.venv/\n.env\n.env.*\n',
      },
      { path: '.env.example', content: 'PORT=3000\n' },
      {
        path: 'README.md',
        content:
          `# ${projectName}\n\n` +
          'FastAPI starter template with health endpoint.\n\n' +
          '## Quick start\n\n' +
          '```bash\npython -m venv .venv\n. .venv/bin/activate\npip install -r requirements.txt\nuvicorn main:app --reload --host 0.0.0.0 --port 3000\n```\n\n' +
          'Open `http://localhost:3000/docs` for interactive API docs.\n',
      },
    ],
    bun: [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: packageName,
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
          "const port = Number(process.env.PORT || 3000);\n\nBun.serve({\n  port,\n  fetch(req) {\n    const url = new URL(req.url);\n\n    if (url.pathname === '/health') {\n      return Response.json({ ok: true, runtime: 'bun', status: 'healthy' });\n    }\n\n    return Response.json({\n      ok: true,\n      runtime: 'bun',\n      message: 'Welcome to your Bun starter',\n      docs: ['/health'],\n      time: new Date().toISOString(),\n    });\n  },\n});\n\nconsole.log(`Bun server running on http://0.0.0.0:${port}`);\n",
      },
      {
        path: '.replit',
        content:
          'entrypoint = "src/index.ts"\n' +
          'run = "bun install && bun run dev"\n',
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
      {
        path: '.gitignore',
        content: '.env\n.env.*\nnode_modules/\n',
      },
      { path: '.env.example', content: 'PORT=3000\n' },
      {
        path: 'README.md',
        content:
          `# ${projectName}\n\n` +
          'Bun starter template with a built-in JSON API.\n\n' +
          '## Quick start\n\n' +
          '```bash\nbun install\nbun run dev\n```\n\n' +
          'Open `http://localhost:3000`.\n',
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

      const preview = await ContainerManager.getPreview(project.id);
      return {
        ...project,
        status: 'stopped',
        preview,
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
      const preview = await ContainerManager.getPreview(project.id);
      return {
        ...project,
        status: 'stopped',
        preview,
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
      const preview = await ContainerManager.getPreview(params.projectId);
      return {
        ...status,
        status: toProjectStatus(status.running),
        preview,
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

  .get(
    '/:projectId/download',
    async ({ params, userId, set }) => {
      if (!userId) {
        set.status = 401;
        return 'Unauthorized';
      }
      if (!checkRateLimit(userId)) {
        set.status = 429;
        return 'Too Many Requests';
      }

      const project = await prisma.projects.findFirst({
        where: { id: params.projectId, userId },
        select: { id: true, name: true },
      });
      if (!project) {
        set.status = 404;
        return 'Project not found';
      }

      const workspacePath = getProjectWorkspacePath(project.id);
      const zipPath = resolve('/tmp', `${project.id}-${Date.now()}.zip`);

      try {
        await $`zip -r ${zipPath} . -x "node_modules/*" "__pycache__/*" ".venv/*" ".git/*" ".next/*"`.cwd(workspacePath);

        const fileStat = await stat(zipPath);
        if (fileStat.size > 500 * 1024 * 1024) {
          await unlink(zipPath);
          set.status = 413;
          return 'Project is too large to download (exceeds 500MB)';
        }

        const file = Bun.file(zipPath);

        set.headers = {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9-]/g, '_')}.zip"`,
        };

        const response = new Response(file);

        response.clone().blob().finally(() => {
          unlink(zipPath).catch(() => { });
        });

        return response;
      } catch (error: any) {
        console.error(`[download] Zip failed for ${project.id}:`, error);
        set.status = 500;
        return 'Failed to generate project archive';
      }
    },
    {
      params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
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

runtimeRoutes.post(
  '/:projectId/files/rename',
  async ({ params, body, userId }) => {
    if (!userId) return new Response('Unauthorized', { status: 401 });
    if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

    const project = await prisma.projects.findFirst({
      where: { id: params.projectId, userId },
      select: { id: true },
    });
    if (!project) return new Response('Project not found', { status: 404 });

    const oldPath = body.oldPath.trim().replace(/^\/+/, '');
    const newPath = body.newPath.trim().replace(/^\/+/, '');

    if (!oldPath || !newPath) {
      return new Response('Invalid paths', { status: 400 });
    }

    const workspacePath = getProjectWorkspacePath(project.id);
    const oldFilePath = resolveProjectPath(workspacePath, oldPath);
    const newFilePath = resolveProjectPath(workspacePath, newPath);

    try {
      await $`mv ${oldFilePath} ${newFilePath}`;
      return { success: true, oldPath, newPath };
    } catch {
      return new Response('Failed to rename', { status: 500 });
    }
  },
  {
    params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    body: t.Object({
      oldPath: t.String({ minLength: 1 }),
      newPath: t.String({ minLength: 1 }),
    }),
  }
);

runtimeRoutes.post(
  '/:projectId/files/copy',
  async ({ params, body, userId }) => {
    if (!userId) return new Response('Unauthorized', { status: 401 });
    if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 });

    const project = await prisma.projects.findFirst({
      where: { id: params.projectId, userId },
      select: { id: true },
    });
    if (!project) return new Response('Project not found', { status: 404 });

    const srcPath = body.srcPath.trim().replace(/^\/+/, '');
    const destPath = body.destPath.trim().replace(/^\/+/, '');

    if (!srcPath || !destPath) {
      return new Response('Invalid paths', { status: 400 });
    }

    const workspacePath = getProjectWorkspacePath(project.id);
    const srcFilePath = resolveProjectPath(workspacePath, srcPath);
    const destFilePath = resolveProjectPath(workspacePath, destPath);

    try {
      await $`cp -r ${srcFilePath} ${destFilePath}`;
      return { success: true, srcPath, destPath };
    } catch {
      return new Response('Failed to copy', { status: 500 });
    }
  },
  {
    params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    body: t.Object({
      srcPath: t.String({ minLength: 1 }),
      destPath: t.String({ minLength: 1 }),
    }),
  }
);

export default runtimeRoutes;
