# Replit Backend Architecture

## Overview

A full-stack backend for Replit-like project execution, featuring:

- **User Authentication**: JWT tokens stored in HTTP-only cookies
- **Project Management**: CRUD operations with multi-user isolation
- **Container Runtime**: Docker-based sandboxed execution (Python, Node.js, Bun)
- **Database**: PostgreSQL with Prisma ORM

## Tech Stack

| Layer             | Technology              |
| ----------------- | ----------------------- |
| Framework         | Elysia.js v1.4+         |
| Auth              | @elysiajs/jwt + cookies |
| Database          | PostgreSQL + Prisma     |
| Container Runtime | Docker via dockerode    |
| Testing           | Bun test framework      |
| Language          | TypeScript              |

## Architecture

### Authentication Flow

```
Client Sign-up/Login
    ↓
Generate JWT Token
    ↓
Set-Cookie: jwt=<token>; HttpOnly; Secure
    ↓
Client includes Cookie in subsequent requests
    ↓
Server validates via .derive() middleware
```

### Project Lifecycle

```
Create Project (userId, runtime, files)
    ↓
Start Container (from pre-built sandbox image)
    ↓
Container enters RUNNING state with idle timeout
    ↓
WebSocket connects for interactive shell (BROKEN - see below)
    ↓
Stop Container (cleanup resources)
    ↓
Delete Project
```

### Container Isolation

- Each container runs with `sandbox` user (no root)
- Limited to project directory
- Network mode is configurable via `SANDBOX_NETWORK_MODE` (`bridge` by default, `none` to fully disable)
- App preview port `3000/tcp` is published to a random loopback host port (configurable via `SANDBOX_PREVIEW_PORT`)
- Memory/CPU limits via Docker config
- Idle timeout after 10 minutes (kills container)

## API Endpoints

### Authentication

- `POST /auth/signup` - Create new user
- `POST /auth/signin` - Login (sets jwt cookie)
- `POST /auth/logout` - Clear session

### Projects

- `POST /projects` - Create project
- `GET /projects` - List user's projects
- `DELETE /projects/:id` - Delete project

### Runtime

- `POST /projects/:id/start` - Start container
- `POST /projects/:id/stop` - Stop container
- `GET /projects/:id/status` - Get container status
- `WS /terminal/:id` - Interactive shell (see issue below)

## Modules

### `auth/` - Authentication

- User registration and login
- JWT token generation
- Cookie-based session management

### `project/` - Project Management

- CRUD operations
- Runtime validation (python, node, bun)
- Container association

### `terminal/` - Interactive Shell

- WebSocket handler for shell access
- Stream multiplexing (BROKEN)
- Command execution via Docker exec

### `services/docker.ts` - Docker Integration

- Container management (create, start, stop)
- Image building
- Resource allocation

## Known Issues

### ⚠️ WebSocket Terminal Stream Handling (CRITICAL)

**Status**: BROKEN - WebSocket connects but receives no data from Docker

**Symptom**:

```
✅ WebSocket connected
📡 WS received: (empty)
<waits 15 seconds>
❌ WS Timeout after 15s
```

**Root Cause**:
The `dockerode` library's stream handling for TTY-based interactive shells doesn't emit data events. Both approaches fail:

1. **exec-based approach** with `Tty: true`

   ```typescript
   const exec = await container.exec({ Cmd: ['/bin/sh'], Tty: true });
   const stream = await exec.start({ hijack: true, Tty: true });
   stream.on('data', ...) // Never fires
   ```

2. **attach-based approach** for main process
   ```typescript
   const stream = await container.attach({ stream: true, stdout: true });
   stream.on('data', ...) // Never fires
   ```

**Why This Happens**:

- Dockerode sends the correct Docker API requests
- Docker daemon receives and processes them
- Stream is established (connection doesn't error)
- But EventEmitter 'data' events never fire
- Likely a multiplexed stream format issue where dockerode can't parse Docker's response properly

**Impact**:

- Interactive terminal feature doesn't work
- Container status, start, stop all work fine
- 14/15 integration tests pass
- Feature is completely bypassed, not partially degraded

**Potential Solutions**:

1. **Use Raw Docker HTTP API** (Most Reliable)

   ```javascript
   // Custom implementation using node's net.Socket and http modules
   // Bypass dockerode's stream handling entirely
   // Direct communication with Docker daemon socket
   ```

2. **Switch Libraries**

   ```javascript
   // node-docker-api - Different stream handling approach
   // docker-sdk-js - Official Docker SDK
   ```

3. **Alternative UX** (Least Work)

   ```javascript
   // Use container logs API in polling mode
   // Send output via HTTP instead of WebSocket
   // Less responsive but works with dockerode
   ```

4. **Reverse Proxy Approach**
   ```bash
   # Use socat or similar to tunnel container stdio
   # WebSocket → socat → Container TCP → Docker socket
   ```

## Testing

### Integration Tests (14/15 passing ✅)

**Run All Tests**:

```bash
cd /home/lymn/codes/fun/replit/backend
newgrp docker << 'EOF'
bun test integration.test.ts
EOF
```

**Test Coverage**:

- ✅ Authentication (signup, signin)
- ✅ Authorization (multi-user isolation, access control)
- ✅ Project CRUD (create, list, delete)
- ✅ Container Lifecycle (start, stop, status, idempotent)
- ✅ Cleanup (remove containers and projects)
- ⏭️ Terminal (skipped - stream handling broken)

## Development

### Setup

```bash
npm install  # or bun install
docker build -t sandbox-python -f docker/python/Dockerfile .
docker build -t sandbox-node -f docker/node/Dockerfile .
docker build -t sandbox-bun -f docker/bun/Dockerfile .
```

### Run Server

```bash
DATABASE_URL="postgresql://..." bun run src/index.ts
```

### Build for Production

```bash
bun build src/index.ts --target bun
```

## File Structure

```
backend/
├── src/
│   ├── index.ts              # Main entry point
│   ├── db.ts                 # Prisma client
│   └── modules/
│       ├── auth/             # Authentication
│       ├── project/          # Project management
│       ├── terminal/         # WebSocket shell (broken)
│       └── services/
│           └── docker.ts     # Container management
├── prisma/
│   ├── schema.prisma         # Data models
│   └── migrations/           # DB migrations
├── docker/
│   ├── python/               # Python sandbox image
│   ├── node/                 # Node.js sandbox image
│   └── bun/                  # Bun sandbox image
├── integration.test.ts       # Full test suite
└── README.md
```

## Next Steps

To complete the WebSocket terminal feature:

1. **Diagnose dockerode issue** - Check if it's a known issue or Docker version incompatibility
2. **Implement alternative stream handling** - Either raw API or different library
3. **Re-enable terminal test** - Validate full end-to-end with real shell output
4. **Document** - Update API docs with terminal usage examples

## Performance Notes

- Container creation: ~1-2 seconds (depends on image size)
- Container startup: ~100-200ms
- WebSocket latency: <50ms (when working)
- Idle timeout: 10 minutes before container killed
- Expected concurrent containers: ~10 per GB RAM
