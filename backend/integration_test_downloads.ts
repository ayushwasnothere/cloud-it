import { $ } from "bun";

async function main() {
  console.log("Booting isolated test server...");
  const server = Bun.spawn(["bun", "run", "src/index.ts"]);
  await Bun.sleep(2000); // Give Elysia time to bind to 3006

  try {
    console.log("Authenticating test user...");
    const loginRes = await fetch("http://localhost:3006/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@mail.com", password: "123456" })
    });
    
    const cookie = loginRes.headers.get("set-cookie");
    if (!cookie) {
      console.log("Auth failed, missing cookie");
      return;
    }

    console.log("Fetching project metadata...");
    const projRes = await fetch("http://localhost:3006/projects", {
      headers: { "Cookie": cookie }
    });
    
    const projects = await projRes.json();
    if (!projects || projects.length === 0) {
       console.log("No projects found for test user.");
       return;
    }
    const projectId = projects[0].id;
    
    console.log(`Testing isolated File Download stream for project ${projectId}...`);
    const fileRes = await fetch(`http://localhost:3006/projects/${projectId}/file/download?path=package.json`, {
      headers: { "Cookie": cookie }
    });
    
    console.log(`File Download Response Status: ${fileRes.status}`);
    if (fileRes.status === 200) {
      const text = await fileRes.text();
      console.log(`[SUCCESS] File Bytes Snippet: ${text.slice(0, 50).trim()}...`);
    } else {
      console.log(`[ERROR] File response payload: ${await fileRes.text()}`);
    }

    console.log(`Testing full recursive ZIP generation for project ${projectId}...`);
    const zipRes = await fetch(`http://localhost:3006/projects/${projectId}/download`, {
      headers: { "Cookie": cookie }
    });
    
    console.log(`ZIP Download Response Status: ${zipRes.status}`);
    if (zipRes.status === 200) {
       const blob = await zipRes.blob();
       console.log(`[SUCCESS] Compressed Workspace Bytes: ${blob.size}`);
    }

  } catch (e) {
    console.error("Test framework caught exception:", e);
  } finally {
    server.kill();
    console.log("Cleaned up background test server.");
  }
}

main();
