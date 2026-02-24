import { status } from "elysia";
import { AuthModel } from "./model";
import { prisma } from "../../db";
export abstract class Auth {
  static async signIn({
    email,
    password,
  }: AuthModel.signInBody): Promise<string> {
    if (!email || !password) {
      throw status(401, "Invalid email or password");
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw status(401, "Invalid email or password");
    }

    const isPasswordValid = await Bun.password.verify(password, user.password);
    if (!isPasswordValid) {
      throw status(401, "Invalid email or password");
    }
    return user.id;
  }

  static async signUp({
    name,
    email,
    password,
  }: AuthModel.signUpBody): Promise<string> {
    if (!name || !email || !password) {
      throw status(400, "Name, email and password are required");
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw status(400, "User already exists");
    }

    const hashedPassword = await Bun.password.hash(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });
    return user.id;
  }

  static async getUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw status(404, "User not found");
    }

    return user;
  }
}
