import { t, type UnwrapSchema } from "elysia";

export namespace AuthModel {
  export const signInBody = t.Object({
    email: t.String(),
    password: t.String(),
  })
  export type signInBody = typeof signInBody.static

  export const signInResponse = t.Object({
    token: t.String(),
  })
  export type signInResponse = typeof signInResponse.static

  export const signInInvalid = t.Literal("Invalid username or password")
  export type signInInvalid = typeof signInInvalid.static



  export const signUpBody = t.Object({
    name: t.String(),
    email: t.String(),
    password: t.String(),
  })
  export type signUpBody = typeof signUpBody.static

  export const signUpResponse = t.Object({
    token: t.String(),
  })
  export type signUpResponse = typeof signUpResponse.static

  export const signUpInvalid = t.Literal("User already exists")
  export type signUpInvalid = typeof signUpInvalid.static

  export const userResponse = t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  })
  export type userResponse = typeof userResponse.static
}