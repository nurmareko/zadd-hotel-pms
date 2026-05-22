import { PrismaClient } from "@prisma/client";

export const TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 20000 } as const;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
