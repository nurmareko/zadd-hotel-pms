"use server";

import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  UserCreateSchema,
  UserIdSchema,
  UserPasswordResetSchema,
  UserUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string };

const USERS_PATH = "/app/admin/users";
const PASSWORD_COST = 10;

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid user data";
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

function prismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      if (uniqueTargetIncludes(error, "username")) {
        return "Username already exists";
      }

      if (uniqueTargetIncludes(error, "email")) {
        return "Email already exists";
      }

      return "User already exists";
    }

    if (error.code === "P2003") {
      return "This user has activity history. Deactivate instead.";
    }

    if (error.code === "P2025") {
      return "User not found";
    }
  }

  return "Something went wrong";
}

export async function createUser(input: unknown): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { password, role, username, fullName, email } = parsed.data;
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
    });

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function updateUser(input: unknown): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { id, role, fullName, email } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
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
    });

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  if (session.user.id === String(parsed.data.id)) {
    return { ok: false, error: "Cannot delete your own account" };
  }

  try {
    await prisma.user.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(USERS_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function toggleUserActive(id: number): Promise<ActionResult> {
  const session = await getAdminSession();

  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  if (session.user.id === String(parsed.data.id)) {
    return { ok: false, error: "Cannot deactivate your own account" };
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
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function resetUserPassword(input: unknown): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = UserPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
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
    return { ok: false, error: prismaErrorMessage(error) };
  }
}
