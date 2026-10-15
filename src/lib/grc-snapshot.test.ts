import { createHash } from "node:crypto";

import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/reservations/[id]/grc/route";
import { GrcSnapshotSchema, type GrcSnapshot } from "@/lib/grc-snapshot";
import { Grc } from "@/lib/pdf/grc";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  settings: vi.fn(),
  render: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: { findUnique: mocks.findUnique, findFirst: mocks.findFirst },
    hotelSettings: { findUnique: mocks.settings },
  },
}));
vi.mock("@react-pdf/renderer", async (importOriginal) => ({
  ...await importOriginal<typeof import("@react-pdf/renderer")>(),
  renderToBuffer: mocks.render,
}));

const signatureDataUrl = "data:image/png;base64,c2lnbmF0dXJl";
const signedAt = new Date("2026-08-05T12:00:00.000Z");

function snapshot(templateVersion: 1 | 2): GrcSnapshot {
  return {
    schemaVersion: 1,
    templateVersion,
    capturedAt: signedAt.toISOString(),
    header: { brandName: "Captured Hotel", hotelAddress: "Captured Address" },
    reservation: {
      reservationNo: "RSV-CAPTURED",
      folioNo: "FOL-CAPTURED",
      arrival: "2026-08-05T00:00:00.000Z",
      departure: "2026-08-06T00:00:00.000Z",
      nights: 1,
      arrangementType: "BB",
      arrangementTypeLabel: templateVersion === 1 ? "BB — Sarapan" : "BB — Breakfast",
      reservationType: "INDIVIDUAL",
      reservationTypeLabel: "Captured reservation type",
    },
    guest: {
      fullName: "Captured Guest", idType: "PASSPORT", idNumber: "P123",
      phone: null, email: null, nationality: null,
    },
    stay: {
      roomNumber: "101", roomTypeName: "Captured Room Type",
      adults: 1, children: 0, stayTotal: "100000", usesNightlyRates: true,
      nightlySchedule: [{ date: "2026-08-05T00:00:00.000Z", rateAmount: "100000" }],
    },
    grcMetadata: {
      purposeOfVisit: templateVersion === 1 ? "Bisnis" : "Business",
      grcFilledAt: signedAt.toISOString(), filledByName: "Captured Operator",
      signedAt: signedAt.toISOString(),
    },
    signatureSha256: createHash("sha256").update(signatureDataUrl).digest("hex"),
  };
}

// Inspect the PDF element tree, including Field components, without relying on
// binary PDF encodings or a system-installed PDF text extractor.
function documentText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(documentText).join("\n");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!React.isValidElement<{ children?: ReactNode }>(node)) return "";
  if (typeof node.type === "function") {
    return documentText((node.type as (props: unknown) => ReactNode)(node.props));
  }
  return documentText(node.props.children);
}

function download(id = "1") {
  return GET(new Request(`http://localhost/api/reservations/${id}/grc`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("React", React);
  mocks.auth.mockResolvedValue({ user: { role: "FO" } });
  mocks.render.mockResolvedValue(Buffer.from("%PDF-test"));
});

afterEach(() => vi.unstubAllGlobals());

describe("signed GRC template compatibility", () => {
  it.each([1, 2] as const)("accepts template %i using only the captured snapshot", async (version) => {
    const captured = snapshot(version);
    const original = structuredClone(captured);
    mocks.findUnique.mockResolvedValue({ signedAt, grcSnapshot: captured, signatureDataUrl });

    const response = await download();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("grc-RSV-CAPTURED.pdf");
    expect(mocks.render).toHaveBeenCalledTimes(1);
    const text = documentText(mocks.render.mock.calls[0][0]);
    expect(text).toContain("Captured Guest");
    expect(text).toContain(captured.reservation.arrangementTypeLabel);
    expect(text).toContain(captured.grcMetadata.purposeOfVisit);
    expect(text).toContain("Captured reservation type");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(captured).toEqual(original);
  });

  it.each([0, 3, -1, 1.5, NaN, Infinity])("rejects unsupported numeric template %s before rendering", async (version) => {
    const captured = { ...snapshot(1), templateVersion: version };
    mocks.findUnique.mockResolvedValue({ signedAt, grcSnapshot: captured, signatureDataUrl });
    const response = await download();
    expect(response.status).toBe(422);
    expect(await response.text()).toBe("The signed GRC cannot be generated because the snapshot template version is unsupported.");
    expect(GrcSnapshotSchema.safeParse(captured).success).toBe(false);
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "1", "2", true, [], {}])("rejects malformed template metadata %j without coercion", async (version) => {
    mocks.findUnique.mockResolvedValue({ signedAt, grcSnapshot: { ...snapshot(1), templateVersion: version }, signatureDataUrl });
    const response = await download();
    expect(response.status).toBe(422);
    expect(await response.text()).toBe("The signed GRC cannot be generated because the stored snapshot is invalid.");
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it.each([1, 2] as const)("preserves strict schema and signature checks for template %i", async (version) => {
    const valid = snapshot(version);
    for (const invalid of [
      { ...valid, schemaVersion: 2 },
      { ...valid, unexpected: "not allowed" },
      { ...valid, guest: { ...valid.guest, unexpected: "not allowed" } },
      { ...valid, signatureSha256: "not-a-hash" },
    ]) {
      mocks.findUnique.mockResolvedValue({ signedAt, grcSnapshot: invalid, signatureDataUrl });
      const response = await download();
      expect(response.status).toBe(422);
      expect(await response.text()).toContain("stored snapshot is invalid");
    }
    for (const signature of [null, "tampered-signature"]) {
      mocks.findUnique.mockResolvedValue({ signedAt, grcSnapshot: valid, signatureDataUrl: signature });
      const response = await download();
      expect(response.status).toBe(422);
      expect(await response.text()).toBe("The signed GRC cannot be generated because signature integrity verification failed.");
    }
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.settings).not.toHaveBeenCalled();
  });

  it("never falls back to live data for a signed GRC without a snapshot", async () => {
    mocks.findUnique.mockResolvedValue({ signedAt, grcSnapshot: null, signatureDataUrl });
    const response = await download();
    expect(response.status).toBe(409);
    expect(await response.text()).toBe("The signed GRC cannot be generated because no signed snapshot is available for this reservation.");
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    [null, 401, "Unauthorized"],
    [{ user: { role: "FB" } }, 403, "Forbidden"],
  ])("preserves authorization checks for %j", async (session, status, message) => {
    mocks.auth.mockResolvedValue(session);
    const response = await download();
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(message);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("returns English validation and not-found messages", async () => {
    const invalid = await download("0");
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toBe("Invalid reservation ID.");
    expect(mocks.findUnique).not.toHaveBeenCalled();
    mocks.findUnique.mockResolvedValue(null);
    const missing = await download();
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Reservation not found.");
  });
});

describe("versioned GRC presentation", () => {
  it.each([
    [1, "Kartu Registrasi Tamu (GRC)", "Nomor Reservasi", "05 Agt 2026", "Paspor · P123", "Tanda Tangan Tamu"],
    [2, "Guest Registration Card (GRC)", "Reservation Number", "05 Aug 2026", "Passport · P123", "Guest Signature"],
  ] as const)("renders template %i labels, dates, identity, and captured content", (version, title, reservationLabel, date, identity, signatureLabel) => {
    const captured = snapshot(version);
    const text = documentText(Grc({ source: { kind: "snapshot", snapshot: captured, signatureDataUrl } }));
    for (const value of [title, reservationLabel, date, identity, signatureLabel, "Rp 100.000", captured.grcMetadata.purposeOfVisit!]) {
      expect(text).toContain(value);
    }
    expect(text).not.toContain(version === 1 ? "Guest Registration Card" : "Kartu Registrasi Tamu");
    // Arrival, nightly schedule, and both metadata timestamps use the template locale.
    expect(text.split(date).length - 1).toBe(4);
  });

  it.each([1, 2] as const)("keeps template %i empty-state and other-ID labels versioned", (version) => {
    const captured = snapshot(version);
    captured.stay.nightlySchedule = [];
    captured.guest.idType = "OTHER";
    captured.guest.idNumber = null;
    captured.grcMetadata.grcFilledAt = null;
    captured.grcMetadata.signedAt = null;
    const text = documentText(Grc({ source: { kind: "snapshot", snapshot: captured, signatureDataUrl } }));
    expect(text).toContain(version === 1 ? "Lainnya" : "Other");
    expect(text).toContain(version === 1 ? "Tanggal: ______________________" : "Date: ______________________");
    expect(text).toContain(version === 1
      ? "Rekaman tarif per malam tidak tersedia; total menggunakan tarif tetap."
      : "Nightly rate records are unavailable; the total uses a flat rate.");
  });
});
