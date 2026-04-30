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

type ActionResult = { ok: true } | { ok: false; error: string };

const ARTICLES_PATH = "/app/admin/articles";

function validationError(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid article data";
}

async function canManageArticles() {
  const session = await auth();

  return session?.user.role === "ADMIN";
}

function prismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "Code already exists";
    }

    if (error.code === "P2003") {
      return "Article is in use";
    }

    if (error.code === "P2025") {
      return "Article not found";
    }
  }

  return "Something went wrong";
}

export async function createArticle(input: unknown): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ArticleCreateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.article.create({
      data: parsed.data,
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function updateArticle(input: unknown): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ArticleUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  const { id, ...data } = parsed.data;

  try {
    await prisma.article.update({
      where: { id },
      data,
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}

export async function deleteArticle(id: number): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = ArticleIdSchema.safeParse({ id });

  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }

  try {
    await prisma.article.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: prismaErrorMessage(error) };
  }
}
