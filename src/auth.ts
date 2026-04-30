import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

import authConfig, { isAppRole } from "./auth.config";
import { prisma } from "@/lib/prisma";

export type { AppRole } from "./auth.config";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username =
          typeof credentials?.username === "string"
            ? credentials.username.trim()
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!username || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username },
          include: { roles: { include: { role: true } } },
        });

        if (!user?.isActive) {
          return null;
        }

        const passwordMatches = await compare(password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        const role = user.roles[0]?.role.code;

        if (!isAppRole(role)) {
          return null;
        }

        return {
          id: String(user.id),
          username: user.username,
          fullName: user.fullName,
          role,
        };
      },
    }),
  ],
});
