"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STAY_FEE_ARTICLE_CODES } from "@/lib/reservation-stay-fee-definitions";
import {
  ArticleCreateSchema,
  ArticleIdSchema,
  ArticleUpdateSchema,
} from "./schema";

type ActionResult = { ok: true } | { ok: false; error: string; field?: string };

const ARTICLES_PATH = "/app/admin/articles";

function isProtectedStayFeeCode(code: string) {
  return STAY_FEE_ARTICLE_CODES.some((protectedCode) => protectedCode === code);
}

function validationFailure(error: {
  issues: { message: string; path: PropertyKey[] }[];
}): ActionResult {
  const issue = error.issues[0];
  const field = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;

  return {
    ok: false,
    error: issue?.message ?? "Invalid article data",
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
      return { ok: false, error: "Code is already in use", field: "code" };
    }

    if (error.code === "P2003") {
      return { ok: false, error: "Article is in use" };
    }

    if (error.code === "P2025") {
      return { ok: false, error: "Article not found" };
    }
  }

  return { ok: false, error: "An error occurred" };
}

export async function createArticle(input: unknown): Promise<ActionResult> {
  if (!(await canManageArticles())) {
    return { ok: false, error: "You do not have permission to perform this action." };
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
      return { ok: false, error: "Code is already in use", field: "code" };
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
    return { ok: false, error: "You do not have permission to perform this action." };
  }

  const parsed = ArticleUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { id, ...data } = parsed.data;

  try {
    const currentArticle = await prisma.article.findUnique({
      where: { id },
      select: { code: true },
    });

    if (currentArticle && isProtectedStayFeeCode(currentArticle.code)) {
      return {
        ok: false,
        error:
          "Stay-flexibility fee articles are managed by the system and cannot be edited.",
      };
    }

    const existingCode = await prisma.article.findFirst({
      where: { code: data.code, id: { not: id } },
      select: { id: true },
    });

    if (existingCode) {
      return { ok: false, error: "Code is already in use", field: "code" };
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
    return { ok: false, error: "You do not have permission to perform this action." };
  }

  const parsed = ArticleIdSchema.safeParse({ id });

  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const currentArticle = await prisma.article.findUnique({
      where: { id: parsed.data.id },
      select: { code: true },
    });

    if (currentArticle && isProtectedStayFeeCode(currentArticle.code)) {
      return {
        ok: false,
        error:
          "Stay-flexibility fee articles are managed by the system and cannot be deleted.",
      };
    }

    await prisma.article.delete({
      where: { id: parsed.data.id },
    });

    revalidatePath(ARTICLES_PATH);

    return { ok: true };
  } catch (error) {
    return prismaErrorResult(error);
  }
}
