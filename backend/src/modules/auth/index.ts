import { Elysia } from "elysia";
import { jwt } from '@elysiajs/jwt'
import { t } from "elysia";

import { Auth } from "./service";
import { AuthModel } from "./model";

export const auth = new Elysia({ prefix: "/auth" })
  .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'super-secret'
        })
  )
  .post(
    "/sign-in",
    async ({ jwt, body, set }) => {
      const id = await Auth.signIn(body)
      if (!id) {
        throw new Error("Invalid email or password");
      }
      const token = await jwt.sign({ id })
      set.cookie = {
        token: {
          value: token,
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60
        }
      }
      return {
        token,
      };
    },
    {
      body: AuthModel.signInBody,
      response: {
        200: AuthModel.signInResponse,
        401: AuthModel.signInInvalid,
      },
    },
  )
  .post(
    "/sign-up",
    async ({ jwt, body, set }) => {
      const id = await Auth.signUp(body);
      if (!id) {
        throw new Error("User already exists");
      }
      const token = await jwt.sign({ id })
      set.cookie = {
        token: {
          value: token,
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60
        }
      }
      return {
        token,
      };
    },
    {
      body: AuthModel.signUpBody,
      response: {
        200: AuthModel.signUpResponse,
        400: AuthModel.signUpInvalid,
      },
    },
  )
  .post(
    "/logout",
    ({ set }) => {
      set.cookie = {
        token: {
          value: "",
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        },
      };
      return { success: true };
    },
    {
      response: {
        200: t.Object({ success: t.Boolean() }),
      },
    },
  )
  .get(
    "/me",
    async ({ jwt, cookie }) => {
      const token = cookie.token?.value;
      if (!token || typeof token !== 'string') {
        throw new Error("No token provided");
      }
      const payload = await jwt.verify(token);
      if (!payload) {
        throw new Error("Invalid token");
      }
      const user = await Auth.getUser((payload as any).id);
      return user;
    },
    {
      response: {
        200: AuthModel.userResponse,
        401: t.String(),
        404: t.String(),
      },
    },
  );
