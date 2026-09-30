import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  exportRows: vi.fn(),
  exportRange: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    nightAudit: { findUnique: mocks.query },
    hotelSettings: { findUnique: mocks.query },
    folio: { findUnique: mocks.query },
  },
}));
vi.mock("@/lib/night-audit", () => ({ buildNightAuditPlan: mocks.query }));
vi.mock("@/lib/arr", () => ({ computeArr: mocks.query }));
vi.mock("@/lib/accounting-export", () => ({
  getAccountingExportRange: mocks.exportRange,
  getAccountingExportRows: mocks.exportRows,
}));
vi.mock("./night-audit/pre-run-summary", () => ({ PreRunSummary: vi.fn() }));
vi.mock("./night-audit/result-panel", () => ({ ResultPanel: vi.fn() }));
vi.mock("./night-audit/run-button", () => ({ RunButton: vi.fn() }));
vi.mock("./reports/[auditId]/report-actions", () => ({ ReportActions: vi.fn() }));
vi.mock("./reports/[auditId]/report-view", () => ({ ReportView: vi.fn() }));

import NightAuditPage from "./night-audit/page";
import AccountingExportPage from "./accounting-export/page";
import NightAuditReportPage from "./reports/[auditId]/page";
import AccFolioPage from "./folios/[folioId]/page";

const dataBoundary = new Error("authorized data access");
beforeEach(() => {
  vi.resetAllMocks();
  // Stop at the data boundary: these tests exercise page guards, not rendering.
  mocks.query.mockImplementation(() => { throw dataBoundary; });
  mocks.exportRange.mockReturnValue({ from: "2026-09-29", to: "2026-09-29" });
  // Export catches query failures, so stop at first consumption of its result.
  mocks.exportRows.mockResolvedValue({ reduce: () => { throw dataBoundary; } });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});

const pages = [
  { name: "night audit (night_audit:run)", render: () => NightAuditPage(), query: mocks.query },
  { name: "accounting export (accounting:export)", render: () => AccountingExportPage({ searchParams: Promise.resolve({}) }), query: mocks.exportRows },
  { name: "audit report (revenue:read OR accounting:export)", render: () => NightAuditReportPage({ params: Promise.resolve({ auditId: "1" }) }), query: mocks.query },
  { name: "folio audit (folios:audit)", render: () => AccFolioPage({ params: Promise.resolve({ folioId: "1" }) }), query: mocks.query },
];

describe.each(pages)("$name authorization", ({ render, query }) => {
  it.each(["ACC", "ADMIN", "GM"])("allows %s to reach the data boundary", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "1", role } });
    await expect(render()).rejects.toBe(dataBoundary);
    expect(query).toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["FO", "HK", "FB", "UNKNOWN"])("rejects %s before data access", async (role) => {
    mocks.auth.mockResolvedValue({ user: { id: "1", role } });
    await expect(render()).rejects.toThrow("redirect:/app/forbidden");
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.exportRows).not.toHaveBeenCalled();
    expect(mocks.exportRange).not.toHaveBeenCalled();
  });

  it("rejects anonymous access before data access", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("redirect:/app/forbidden");
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.exportRows).not.toHaveBeenCalled();
    expect(mocks.exportRange).not.toHaveBeenCalled();
  });
});
