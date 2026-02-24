# Cloud IDE Frontend

A production-ready cloud IDE frontend built with Next.js, Monaco Editor, and xterm.js. Connects to an Elysia-based backend for terminal access and container management.

## Features

- **Authentication**: JWT-based auth with secure HTTP-only cookies
- **Project Management**: Create, list, and manage cloud IDE projects
- **Code Editor**: Monaco Editor with syntax highlighting and auto-save
- **Terminal**: Real-time terminal via WebSocket with xterm.js
- **Container Control**: Start/stop projects with status management
- **Responsive Design**: Works on desktop and tablet devices
- **Dark Theme**: Vercel Classic Dark theme for a professional look

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **State Management**: Zustand
- **Editor**: Monaco Editor via @monaco-editor/react
- **Terminal**: xterm.js with WebSocket support
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Toast Notifications**: Sonner

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm/pnpm/yarn package manager
- Backend API server running (see Backend Setup below)

### Installation

1. **Clone and install dependencies**

```bash
pnpm install
```

2. **Configure environment variables**

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Replace with your actual backend URL.

3. **Start development server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  (auth)/              # Authentication pages
    login/
    signup/
  (main)/              # Protected routes
    dashboard/         # Project listing
    projects/[id]/     # IDE editor
  layout.tsx           # Root layout
  page.tsx             # Home redirect

components/
  auth/                # Auth forms
  dashboard/           # Dashboard components
  editor/              # Editor components (Monaco, FileBrowser)
  terminal/            # Terminal components (xterm)
  layout/              # Layout components (TopBar, Sidebar)
  ui/                  # shadcn/ui components

hooks/
  useAuth.ts           # Authentication hook
  useProjects.ts       # Projects management hook
  useTerminal.ts       # Terminal WebSocket hook
  useDebounce.ts       # Debouncing utilities

state/
  authStore.ts         # Auth state (Zustand)
  projectsStore.ts     # Projects state (Zustand)
  editorStore.ts       # Editor state (Zustand)

api/
  auth.ts              # Auth API calls
  projects.ts          # Projects API calls

types/
  index.ts             # TypeScript types and interfaces

utils/
  api.ts               # API request wrapper with error handling
  constants.ts         # App-wide constants
  validation.ts        # Form validation utilities
```

## Key Features

### Authentication Flow

1. User signs up/logs in via `/signup` or `/login`
2. Backend returns JWT token in HTTP-only cookie
3. Token automatically included in API requests
4. Session check on app load redirects to login if expired

### Project Management

- **Dashboard**: List all projects with status badges
- **Create**: Modal form to create new projects with runtime selection
- **Delete**: Confirmation dialog with permanent deletion
- **Status**: Real-time status updates (running/stopped/starting/stopping)

### IDE Editor

- **File Browser**: Left sidebar showing project files
- **Monaco Editor**: Center editor with syntax highlighting
- **Terminal**: Bottom resizable terminal panel
- **Auto-save**: Files auto-save with 500ms debounce
- **Tabs**: Open multiple files in tabs

### Terminal

- **WebSocket Connection**: Real-time terminal via WS protocol
- **Reconnection**: Automatic reconnection with exponential backoff
- **Input/Output**: Full bidirectional communication
- **Status Indicator**: Shows connection status

## API Requirements

The frontend expects these backend endpoints:

### Authentication

```
POST /auth/sign-in
POST /auth/sign-up
GET /auth/me
POST /auth/logout
```

### Projects

```
GET /projects
GET /projects/:id
POST /projects
DELETE /projects/:id
POST /projects/:id/start
POST /projects/:id/stop
GET /projects/:id/status
```

### WebSocket Terminal

```
WS /terminal/:projectId
```

## Error Handling

- **401 Unauthorized**: Redirects to login
- **404 Not Found**: Shows "Resource not found" message
- **429 Rate Limited**: Shows toast and retries with backoff
- **Network Errors**: Automatic retry with exponential backoff
- **Terminal Disconnect**: Automatic reconnection (up to 5 attempts)

## Performance Optimizations

- **Code Splitting**: Monaco Editor and Terminal dynamically imported
- **Debouncing**: Container start/stop buttons debounced (300ms)
- **Polling**: Status polling with exponential backoff
- **Memoization**: Expensive components optimized with React.memo
- **Lazy Loading**: Components loaded on-demand

## Deployment

### Build

```bash
pnpm build
```

### Production

Deploy to Vercel:

```bash
vercel deploy
```

Or manually:

```bash
pnpm build
pnpm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL |

## Troubleshooting

### WebSocket Connection Failed

- Ensure backend is running and accessible
- Check that WebSocket proxy is configured in your deployment
- Verify `NEXT_PUBLIC_API_URL` points to correct backend

### Terminal Not Working

- Confirm project is in "running" state
- Check backend terminal WebSocket implementation
- Review browser console for connection errors

### Auth Issues

- Clear browser cookies
- Check HTTP-only cookie configuration on backend
- Verify CORS settings include credentials

## Contributing

When adding new features:

1. Keep components small and focused
2. Use Zustand for global state
3. Implement error handling with toast notifications
4. Add loading states to async operations
5. Test on mobile devices

## License

MIT

## Support

For issues or questions, contact the development team or open an issue in the repository.
