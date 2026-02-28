<div align="center">
  <img src="frontend/public/android-chrome-192x192.png" alt="CloudIt Logo" width="120" />
  <h1>CloudIt</h1>
  <p><strong>A blazingly fast, modern cloud IDE.</strong></p>
  <p>
    Connects to an Elysia-based backend for instant WebSockets, container management, and native file hooks.<br>
    Rendered beautifully in a minimalist high-contrast aesthetic.
  </p>

  <br />

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](#)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](#)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-React-007ACC?logo=visualstudiocode)](#)
[![Elysia.js](https://img.shields.io/badge/Elysia-Bun-f3d300?logo=bun)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwindcss)](#)

  <br />
  <img src="public/screenshots/preview.png" alt="CloudIt Editor Interface" width="100%" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />
  <br />
</div>

<br />

## ✨ Features

- **Authentication**: JWT-based auth with secure HTTP-only cookies
- **Project Management**: Create, list, manage, and download cloud IDE projects as ZIP archives
- **Code Editor**: Monaco Editor (with custom `vercel-dark` pure black theme), syntax highlighting, and auto-save
- **Terminal**: Real-time terminal via WebSocket with xterm.js
- 🧬 **Native File Operations**: Right-click context menu (Cut, Copy, Paste, Rename, Delete, Download) executing natively on the disk
- 🌙 **Modern Editor**: Monaco Editor customized with a pure black `#000000` `vercel-dark` high-contrast theme
- 💻 **Terminal Integration**: Real-time terminal sessions via WebSocket with xterm.js
- 🐋 **Containerized Sandboxes**: Every project securely runs inside its own isolated Docker environment, dynamically provisioned via Dockerode for pristine, zero-conflict runtimes (Node, Python, Bun).
- ⚡ **Workspace Orchestration**: Containers are synced instantly to local volumes, allowing immediate execution with automatic start/stop states to preserve system resources.

<br />

<div align="center">
  <img src="public/screenshots/preview.png" alt="FileBrowser Context Menu Preview" width="80%" style="border-radius: 8px;" />
  <br /><br />
  <img src="public/screenshots/preview_port-preview.png" alt="Live Port Preview Interface" width="80%" style="border-radius: 8px;" />
</div>

<br />

## 🛠 Tech Stack

### Frontend

- **Framework**: Next.js 16 (App Router)
- **State Management**: Zustand
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Terminal**: xterm.js with WebSocket support
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React

### Backend

- **Framework**: Elysia.js + Bun
- **Database**: PostgreSQL with Prisma ORM
- **Containerization**: Dockerode for workspace isolation
- **Authentication**: `@elysiajs/jwt`

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL installed and running
- Docker installed and running
- pnpm package manager

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/ayushwasnothere/cloud-it
cd cloud-it
```

2. **Backend Setup**

You can either use a hosted PostgreSQL instance (like Neon or Supabase) or instantly spin one up locally via Docker:

```bash
# Optional: Spin up a local PostgreSQL database
docker-compose up -d
```

```bash
cd backend
bun install

# Configure your environment
cp .env.example .env

# If you used docker-compose, your .env DATABASE_URL should look like:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/cloudit"

# Run Prisma Migrations
bunx prisma db push

# Start the Backend Development server
bun dev
```

3. **Frontend Setup**

```bash
cd ../frontend
bun install

# Configure your environment
cp .env.local.example .env.local  # Set NEXT_PUBLIC_API_URL=http://localhost:3006

# Start the Frontend Development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Developer Flows

### File Operations

CloudIt hooks into powerful native OS bindings through `Bun.$` to execute rapid workspace modifications:

- **ZIP Downloads**: Rapid server-side archiving bypassing heavy directories like `node_modules` or `__pycache__`.
- **System Move/Copy**: `mv` and `cp` are triggered via the custom ContextMenu, keeping UI latency at a minimum.

### 🐋 Secure Docker Orchestration

Every project automatically boots its own isolated Docker container to ensure complete environment parity and security:

- **Language Support**: The backend dynamically assigns lightweight `node:20-alpine`, `python:3.11-alpine`, or `oven/bun:alpine` containers based on user selection.
- **Persistent Volume Mounts**: Container volumes are intricately bind-mounted to your local project directories, meaning code edits instantly execute inside the sandbox without manual synchronization commands.

### 🔌 Terminal & WebSockets

Real-time terminal sessions are fully encrypted and secured via HTTP-only Auth cookies mapped directly to active Dockerode `exec` streams in `src/modules/terminal.ts`. Active containers are smartly paused and removed cleanly when sockets drop.

## Contributing

1. Keep components modular and strict.
2. Adhere to the pure black (`#000000`) and minimal high-contrast theme aesthetics over default template colors.
3. Validate API interactions through localized `toast` feedback.

## License

MIT
