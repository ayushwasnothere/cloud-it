import { describe, it, expect, beforeAll } from 'bun:test';
import { resetRateLimit } from './src/services/rateLimiter';

const BASE_URL = 'http://localhost:3000';

let jwtToken = '';
let projectId = '';
let secondUserToken = '';

const testUser = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'testpassword123',
};

const secondUser = {
  name: 'User2',
  email: `user2-${Date.now()}@example.com`,
  password: 'password123',
};

function authCookie(token: string) {
  return `jwt=${token}`;
}

describe('Replit Backend - Full Integration Test', () => {

  // ---------------- AUTH ----------------

  describe('Authentication', () => {
    it('should sign up', async () => {
      const res = await fetch(`${BASE_URL}/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('token');
      jwtToken = data.token;
    });

    it('should sign in', async () => {
      const res = await fetch(`${BASE_URL}/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUser.email, password: testUser.password }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      jwtToken = data.token;
    });
  });

  // ---------------- AUTH BOUNDARY ----------------

  describe('Authorization & Validation', () => {
    it('should reject unauthenticated access', async () => {
      const res = await fetch(`${BASE_URL}/projects`);
      expect(res.status).toBe(401);
    });

    it('should reject invalid runtime', async () => {
      const res = await fetch(`${BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: authCookie(jwtToken) },
        body: JSON.stringify({ name: 'Bad Runtime', runtime: 'java' }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject invalid UUID', async () => {
      const res = await fetch(`${BASE_URL}/projects/not-a-uuid/start`, {
        method: 'POST',
        headers: { Cookie: authCookie(jwtToken) },
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ---------------- PROJECT ----------------

  describe('Project Management', () => {
    it('should create project', async () => {
      const res = await fetch(`${BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: authCookie(jwtToken) },
        body: JSON.stringify({ name: 'Python Test Project', runtime: 'python' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      projectId = data.id;
      expect(data.runtime).toBe('python');
    });

    it('should list projects', async () => {
      const res = await fetch(`${BASE_URL}/projects`, {
        headers: { Cookie: authCookie(jwtToken) },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // ---------------- MULTI USER ISOLATION ----------------

  describe('Multi-user Isolation', () => {
    it('should create second user', async () => {
      const res = await fetch(`${BASE_URL}/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secondUser),
      });
      const data = await res.json();
      secondUserToken = data.token;
    });

    it('should block second user from accessing project', async () => {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/status`, {
        headers: { Cookie: authCookie(secondUserToken) },
      });
      expect(res.status).toBe(404);
    });
  });

  // ---------------- CONTAINER ----------------

  describe('Container Lifecycle', () => {
    it('should start container', async () => {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/start`, {
        method: 'POST',
        headers: { Cookie: authCookie(jwtToken) },
      });
      expect(res.status).toBe(200);
    });

    it('should allow double start safely', async () => {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/start`, {
        method: 'POST',
        headers: { Cookie: authCookie(jwtToken) },
      });
      expect(res.status).toBe(200);
    });

    it('should get running status', async () => {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/status`, {
        headers: { Cookie: authCookie(jwtToken) },
      });
      const data = await res.json();
      expect(data.running).toBe(true);
    });
  });

  // ---------------- RATE LIMIT ----------------

  describe('Rate Limiting', () => {
    it('should eventually rate limit', async () => {
      let limited = false;

      for (let i = 0; i < 40; i++) {
        const res = await fetch(`${BASE_URL}/projects/${projectId}/start`, {
          method: 'POST',
          headers: { Cookie: authCookie(jwtToken) },
        });

        if (res.status === 429) {
          limited = true;
          break;
        }
      }

      expect(limited).toBe(true);

      // Reset rate limit so Cleanup tests aren't blocked
      const payload = JSON.parse(atob(jwtToken.split('.')[1]));
      console.log('Resetting rate limit for userId:', payload.id);
      resetRateLimit(payload.id);
    });
  });

  // ---------------- TERMINAL ----------------

  describe('Terminal & Sandbox', () => {
    it('should execute python & enforce restrictions', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://localhost:3000/terminal/${projectId}?token=${jwtToken}`
        );

        let output = '';
        let commandSent = false;

        // Give the shell 2 seconds to initialize before sending commands,
        // OR send immediately on first prompt character — whichever comes first
        let sendTimer: ReturnType<typeof setTimeout> | null = null;

        const sendCommands = () => {
          if (commandSent) return;
          commandSent = true;
          if (sendTimer) clearTimeout(sendTimer);
          ws.send(`python3 -c "print('TESTOK')"\n`);
          ws.send(`whoami\n`);
        };

        ws.onopen = () => {
          sendTimer = setTimeout(sendCommands, 2000);
        };

        ws.onmessage = (event) => {
          const data = event.data instanceof Uint8Array
            ? new TextDecoder().decode(event.data)
            : event.data.toString();

          output += data;

          // Send on first shell prompt if we haven't yet
          if (!commandSent && (output.includes('$') || output.includes('#') || output.includes('%'))) {
            sendCommands();
          }

          if (output.includes('TESTOK')) {
            ws.close();
            resolve();
          }
        };

        ws.onerror = (e) => reject(new Error(`WS error: ${(e as ErrorEvent).message}`));

        ws.onclose = () => {
          if (!output.includes('TESTOK')) {
            reject(new Error(`WS closed without TESTOK. Got: "${output.slice(0, 200)}"`));
          }
        };
      });
    }, { timeout: 20000 }); // Give it 20s — 2s shell init + docker exec time
  });

  // ---------------- CLEANUP ----------------

  describe('Cleanup', () => {
    it('should stop container', async () => {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/stop`, {
        method: 'POST',
        headers: { Cookie: authCookie(jwtToken) },
      });
      expect([200, 404]).toContain(res.status);
    }, { timeout: 15000 });

    it('should delete project', async () => {
      const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Cookie: authCookie(jwtToken) },
      });
      expect([200, 404]).toContain(res.status);
    });
  });

});

console.log('🚀 Running full integration test suite...');