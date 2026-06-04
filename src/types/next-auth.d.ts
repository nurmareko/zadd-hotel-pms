import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      role: AppRole;
      isSupervisor: boolean;
      sessionStartedAt?: string;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    fullName: string;
    role: AppRole;
    isSupervisor: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    fullName: string;
    role: AppRole;
    isSupervisor: boolean;
  }
}
