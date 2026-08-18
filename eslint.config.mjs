import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const prismaModuleNames = new Set(["@prisma/client", "@/lib/prisma"]);

const requireForceDynamicForPrismaPage = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require database-backed Next.js pages to opt out of build-time prerendering.",
    },
    schema: [],
    messages: {
      missingForceDynamic:
        'This page imports Prisma but does not export `const dynamic = "force-dynamic"`. Without it, Next.js may prerender database data at build time and serve stale data.',
    },
  },
  create(context) {
    let importsPrisma = false;
    let exportsForceDynamic = false;

    return {
      ImportDeclaration(node) {
        if (prismaModuleNames.has(node.source.value)) {
          importsPrisma = true;
        }
      },
      ExportNamedDeclaration(node) {
        if (node.declaration?.type !== "VariableDeclaration") {
          return;
        }

        exportsForceDynamic ||= node.declaration.declarations.some(
          (declaration) =>
            declaration.id.type === "Identifier" &&
            declaration.id.name === "dynamic" &&
            declaration.init?.type === "Literal" &&
            declaration.init.value === "force-dynamic",
        );
      },
      "Program:exit"(node) {
        if (importsPrisma && !exportsForceDynamic) {
          context.report({ node, messageId: "missingForceDynamic" });
        }
      },
    };
  },
};

const localPlugin = {
  rules: {
    "require-force-dynamic-for-prisma-page": requireForceDynamicForPrismaPage,
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/**/page.tsx"],
    plugins: {
      local: localPlugin,
    },
    rules: {
      "local/require-force-dynamic-for-prisma-page": "error",
    },
  },
  // This import-based guard cannot trace database access through helper modules.
  // Known indirect pages currently include ACC Night Audit, FO Tape Chart,
  // HK Clean, and HK Rooms; covering arbitrary helper call graphs in ESLint would
  // be brittle, so those pages still require review when their data access changes.
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/archive/mockups_console_legacy/**",
  ]),
]);

export default eslintConfig;
