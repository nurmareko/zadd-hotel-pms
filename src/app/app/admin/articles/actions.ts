"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ArticleCreateSchema,
  ArticleIdSchema,
  ArticleUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

const ARTICLES_PATH = "/app/admin/articles";

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): ActionResult {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Data artikel tidak valid",
    field,
  };
}

async function canManageArticles() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorResult(error: unknown): ActionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { ok: false, error: "Kode sudah digunakan", field: "code" };
    }

    if (error.code === "P2003") {
      return { ok: false, error: "Artikel sedang digunakan" };
    }

    if (error.code === "P2025") {
      return { ok: false, error: "Artikel tidak ditemukan" };
    }
  }

  return { ok: false, error: "Terjadi kesalahan" };
}

export async function createArticle(input: unknown): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ArticleCreateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const existingCode = await prisma.article.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });

    if (existingCode) {
      return { ok: false, error: "Kode sudah digunakan", field: "code" };
    }

    await prisma.article.create({
      data: parsed.data,
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function updateArticle(input: unknown): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ArticleUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { id, ...data } = parsed.data;

  try {
    const existingCode = await prisma.article.findFirst({
      where: { code: data.code, id: { not: id } },
      select: { id: true },
    });

    if (existingCode) {
      return { ok: false, error: "Kode sudah digunakan", field: "code" };
    }

    await prisma.article.update({
      where: { id },
      data,
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}

export async function deleteArticle(id: number): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ArticleIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    await prisma.article.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}
