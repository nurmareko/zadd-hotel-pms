import type { NextAuthConfig } from "next-auth";

export type AppRole = "FO" | "HK" | "FB" | "ACC" | "ADMIN";

const appRoles = ["FO", "HK", "FB", "ACC", "ADMIN"] as const;

export function isAppRole(role: string | undefined): role is AppRole {
  return appRoles.some((appRole) => appRole === role);
}

const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? "";
        token.username = user.username;
        token.fullName = user.fullName;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.username = token.username as string;
      session.user.fullName = token.fullName as string;
      session.user.role = token.role as AppRole;
      session.user.sessionStartedAt =
        typeof token.iat === "number"
          ? new Date(token.iat * 1000).toISOString()
          : undefined;

      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
