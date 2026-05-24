"use server";

import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import {
  UserCreateSchema,
  UserIdSchema,
  UserPasswordResetSchema,
  UserUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

const USERS_PATH = "/app/admin/users";
const PASSWORD_COST = 10;

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): ActionResult {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Data pengguna tidak valid",
    field,
  };
}

async function getAdminSession() {
  const session = await auth();

  if (session?.user.role !== "ADMIN") {
    return null;
  }

  return session;
}

function uniqueTargetIncludes(
  error: Prisma.PrismaClientKnownRequestError,
  field: string,
) {
  const target = error.meta?.target;

  return Array.isArray(target)
    ? target.some((item) => item === field)
    : typeof target === "string" && target.includes(field);
}

function prismaErrorResult(error: unknown): ActionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      if (uniqueTargetIncludes(error, "username")) {
        return {
          ok: false,
          error: "Username sudah digunakan",
          field: "username",
        };
      }

      if (uniqueTargetIncludes(error, "email")) {
        return { ok: false, error: "Email sudah digunakan", field: "email" };
      }

      return { ok: false, error: "Pengguna sudah ada" };
    }

    if (error.code === "P2003") {
      return {
        ok: false,
        error: "Pengguna memiliki riwayat aktivitas. Nonaktifkan pengguna.",
      };
    }

    if (error.code === "P2025") {
      return { ok: false, error: "Pengguna tidak ditemukan" };
    }
  }

  return { ok: false, error: "Terjadi kesalahan" };
}

export async function createUser(input: unknown): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserCreateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { password, role, username, fullName, email } = parsed.data;

  const existingUsername = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUsername) {
    return {
      ok: false,
      error: "Username sudah digunakan",
      field: "username",
    };
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return { ok: false, error: "Email sudah digunakan", field: "email" };
    }
  }

  const passwordHash = await hash(password, PASSWORD_COST);

  try {
    await prisma.$transaction(async (tx) => {
      const roleRecord = await tx.role.findUniqueOrThrow({
        where: { code: role },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          username,
          fullName,
          email,
          passwordHash,
        },
        select: { id: true },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecord.id,
        },
      });
    }, TRANSACTION_OPTIONS);

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function updateUser(input: unknown): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { id, role, username, fullName, email } = parsed.data;

  const existingUsername = await prisma.user.findFirst({
    where: { username, id: { not: id } },
    select: { id: true },
  });

  if (existingUsername) {
    return {
      ok: false,
      error: "Username sudah digunakan",
      field: "username",
    };
  }

  if (email) {
    const existingEmail = await prisma.user.findFirst({
      where: { email, id: { not: id } },
      select: { id: true },
    });

    if (existingEmail) {
      return { ok: false, error: "Email sudah digunakan", field: "email" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          username,
          fullName,
          email,
        },
        select: { id: true },
      });

      const currentRole = await tx.userRole.findFirst({
        where: { userId: id },
        include: { role: { select: { code: true } } },
      });

      if (currentRole?.role.code === role) {
        return;
      }

      const roleRecord = await tx.role.findUniqueOrThrow({
        where: { code: role },
        select: { id: true },
      });

      await tx.userRole.deleteMany({
        where: { userId: id },
      });

      await tx.userRole.create({
        data: {
          userId: id,
          roleId: roleRecord.id,
        },
      });
    }, TRANSACTION_OPTIONS);

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  if (session.user.id === String(parsed.data.id)) {
    return { ok: false, error: "Tidak bisa menghapus akun sendiri" };
  }

  try {
    await prisma.user.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function toggleUserActive(id: number): Promise<ActionResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  if (session.user.id === String(parsed.data.id)) {
    return { ok: false, error: "Tidak bisa menonaktifkan akun sendiri" };
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: parsed.data.id },
      select: { isActive: true },
    });

    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { isActive: !user.isActive },
    });

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function resetUserPassword(input: unknown): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const passwordHash = await hash(parsed.data.password, PASSWORD_COST);

  try {
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { passwordHash },
    });

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}
