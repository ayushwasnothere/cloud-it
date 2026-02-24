import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cors } from "@elysiajs/cors";
import { auth } from "./modules/auth";
import ws from "./modules/terminal";
import runtimeRoutes from "./modules/project/runtime";

const app = new Elysia()
  .use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ],
      credentials: true,
    }),
  )
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "super-secret",
    }),
  )
  .use(auth)
  .use(ws)
  .use(runtimeRoutes)
  .get("/health", () => ({
    status: "ok",
  }))

  .listen(3006, () => {
    console.log("Server is running on http://localhost:3006");
  });
