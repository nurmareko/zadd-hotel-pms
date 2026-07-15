import { Prisma, ReservationStatus } from "@prisma/client";

import { ARRANGEMENT_INCLUSION_ARTICLE_CODES } from "@/lib/arrangement-inclusions";
import { prisma } from "@/lib/prisma";
import {
  hasLegacyNightlyRoomChargeShape,
  linkedRoomChargeShapeIssues,
} from "@/lib/room-charge-integrity";
import {
  ROOM_CHARGE_ARTICLE_CODE,
  STAY_CHARGE_ARTICLE_CODES,
} from "@/lib/stay-charges";

const CUTOVER_STATUSES = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKED_OUT,
] as const;

const BLOCKING_CLASS_NUMBERS = new Set([
  1, 2, 3, 4, 6, 7, 10, 11, 12, 13,
]);
const canonicalArticleCodes = new Set<string>(STAY_CHARGE_ARTICLE_CODES);

type Finding = {
  reservationId: number;
  reservationNo: string;
  folioId?: number;
  folioNo?: string;
  description: string;
};

type FindingClass = {
  number: number;
  name: string;
  disposition: "BLOCKING" | "EXPECTED / INFORMATIONAL";
  findings: Finding[];
};

const reservationSelection = Prisma.validator<Prisma.ReservationDefaultArgs>()({
  select: {
    id: true,
    reservationNo: true,
    arrangementType: true,
    arrivalDate: true,
    departureDate: true,
    rateAmount: true,
    reservationNights: {
      select: { id: true, date: true, rateAmount: true },
      orderBy: { date: "asc" },
    },
    folio: {
      select: {
        id: true,
        folioNo: true,
        lineItems: {
          select: {
            id: true,
            articleId: true,
            fbOrderId: true,
            reservationNightId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
            postedAt: true,
            article: { select: { code: true, name: true } },
            reservationNight: {
              select: { reservationId: true, date: true, rateAmount: true },
            },
          },
          orderBy: [{ postedAt: "asc" }, { id: "asc" }],
        },
      },
    },
  },
});

type ScannedReservation = Prisma.ReservationGetPayload<
  typeof reservationSelection
>;
type ScannedLineItem = NonNullable<ScannedReservation["folio"]>["lineItems"][number];

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function expectedDateKeys(arrivalDate: Date, departureDate: Date): string[] {
  const dates: string[] = [];

  for (
    let cursor = new Date(arrivalDate);
    cursor < departureDate;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    dates.push(dateKey(cursor));
  }

  return dates;
}

function identifier(finding: Finding): string {
  const reservation = `reservation ${finding.reservationNo} (id=${finding.reservationId})`;
  const folio =
    finding.folioId === undefined
      ? ""
      : `; folio ${finding.folioNo ?? "unknown"} (id=${finding.folioId})`;

  return `${reservation}${folio}`;
}

function expectedArticleCodes(
  reservation: ScannedReservation,
): Set<string> {
  return new Set([
    ROOM_CHARGE_ARTICLE_CODE,
    ...ARRANGEMENT_INCLUSION_ARTICLE_CODES[reservation.arrangementType],
  ]);
}

function folioFinding(
  reservation: ScannedReservation,
  description: string,
): Finding {
  return {
    reservationId: reservation.id,
    reservationNo: reservation.reservationNo,
    folioId: reservation.folio?.id,
    folioNo: reservation.folio?.folioNo,
    description,
  };
}

function unlinkedCanonicalLines(
  reservation: ScannedReservation,
): ScannedLineItem[] {
  return (
    reservation.folio?.lineItems.filter(
      (line) =>
        line.reservationNightId === null &&
        line.fbOrderId === null &&
        canonicalArticleCodes.has(line.article.code),
    ) ?? []
  );
}

function hasNightlyLineShape(
  reservation: ScannedReservation,
  line: ScannedLineItem,
): boolean {
  if (
    !line.quantity.equals(1) ||
    !line.amount.equals(line.unitPrice) ||
    !line.unitPrice.isInteger() ||
    line.unitPrice.isNegative()
  ) {
    return false;
  }

  if (line.article.code === ROOM_CHARGE_ARTICLE_CODE) {
    return hasLegacyNightlyRoomChargeShape({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      reservationRateAmount: reservation.rateAmount,
    });
  }

  return (
    line.description === line.article.name ||
    line.description.startsWith(`Night Audit ${line.article.name} Inclusion - `)
  );
}

function addScheduleFindings(
  reservation: ScannedReservation,
  classes: Map<number, FindingClass>,
) {
  const expected = expectedDateKeys(
    reservation.arrivalDate,
    reservation.departureDate,
  );
  const expectedSet = new Set(expected);
  const actual = reservation.reservationNights.map((night) => dateKey(night.date));
  const actualSet = new Set(actual);
  const missing = expected.filter((date) => !actualSet.has(date));
  const outOfRange = actual.filter((date) => !expectedSet.has(date));

  if (actual.length === 0) {
    classes.get(1)?.findings.push(
      folioFinding(
        reservation,
        `zero ReservationNight rows; expected ${expected.length} night(s) for ${dateKey(reservation.arrivalDate)} through ${dateKey(reservation.departureDate)} (departure excluded)`,
      ),
    );
  }

  if (actual.length !== expected.length || missing.length > 0) {
    classes.get(2)?.findings.push(
      folioFinding(
        reservation,
        `expected ${expected.length} row(s), found ${actual.length}; missing dates: ${missing.length > 0 ? missing.join(", ") : "none"}`,
      ),
    );
  }

  if (outOfRange.length > 0) {
    classes.get(3)?.findings.push(
      folioFinding(
        reservation,
        `out-of-range night dates: ${[...new Set(outOfRange)].join(", ")}`,
      ),
    );
  }

  const invalidRateNights = reservation.reservationNights.filter(
    (night) => !night.rateAmount.isInteger() || night.rateAmount.isNegative(),
  );
  if (invalidRateNights.length > 0) {
    classes.get(4)?.findings.push(
      folioFinding(
        reservation,
        `invalid nightly rates: ${invalidRateNights
          .map((night) => `${dateKey(night.date)}=${night.rateAmount.toString()}`)
          .join(", ")}`,
      ),
    );
  }

  const firstNight = reservation.reservationNights[0];
  if (firstNight && !firstNight.rateAmount.equals(reservation.rateAmount)) {
    classes.get(13)?.findings.push(
      folioFinding(
        reservation,
        `reservation rate=${reservation.rateAmount.toString()}; first night ${dateKey(firstNight.date)}=${firstNight.rateAmount.toString()}`,
      ),
    );
  }

  const variableRateNights = reservation.reservationNights
    .slice(1)
    .filter((night) => !night.rateAmount.equals(reservation.rateAmount));
  if (variableRateNights.length > 0) {
    classes.get(5)?.findings.push(
      folioFinding(
        reservation,
        `first-night compatibility rate=${reservation.rateAmount.toString()}; variable later nights: ${variableRateNights
          .map((night) => `${dateKey(night.date)}=${night.rateAmount.toString()}`)
          .join(", ")}`,
      ),
    );
  }
}

function addLineItemFindings(
  reservation: ScannedReservation,
  classes: Map<number, FindingClass>,
) {
  const folio = reservation.folio;
  if (!folio) {
    return;
  }

  const expectedDates = expectedDateKeys(
    reservation.arrivalDate,
    reservation.departureDate,
  );
  const expectedDateIndex = new Map(
    expectedDates.map((date, index) => [date, index]),
  );
  const applicableCodes = expectedArticleCodes(reservation);
  const unlinked = unlinkedCanonicalLines(reservation);

  const roomChargeLines = folio.lineItems.filter(
    (line) =>
      line.article.code === ROOM_CHARGE_ARTICLE_CODE && line.fbOrderId === null,
  );
  if (roomChargeLines.length > expectedDates.length) {
    classes.get(6)?.findings.push(
      folioFinding(
        reservation,
        `${roomChargeLines.length} canonical ROOM-CHARGE line(s), expected at most ${expectedDates.length}; line ids: ${roomChargeLines.map((line) => line.id).join(", ")}`,
      ),
    );
  }

  const unlinkedByArticle = new Map<string, ScannedLineItem[]>();
  for (const line of unlinked) {
    unlinkedByArticle.set(line.article.code, [
      ...(unlinkedByArticle.get(line.article.code) ?? []),
      line,
    ]);
  }
  const classifiedPrefixByArticle = new Map<string, ScannedLineItem[]>();
  const manualCanonicalByArticle = new Map<string, ScannedLineItem[]>();

  for (const [articleCode, lines] of unlinkedByArticle) {
    const prefix: ScannedLineItem[] = [];
    for (const line of lines) {
      if (
        prefix.length >= expectedDates.length ||
        !applicableCodes.has(articleCode) ||
        !hasNightlyLineShape(reservation, line)
      ) {
        break;
      }
      prefix.push(line);
    }
    const prefixIds = new Set(prefix.map((line) => line.id));
    const manual = lines.filter((line) => !prefixIds.has(line.id));

    if (prefix.length > 0) {
      classifiedPrefixByArticle.set(articleCode, prefix);
    }
    if (manual.length > 0) {
      manualCanonicalByArticle.set(articleCode, manual);
    }
  }

  for (const [articleCode, lines] of [...unlinkedByArticle].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const prefixCount = classifiedPrefixByArticle.get(articleCode)?.length ?? 0;
    classes.get(8)?.findings.push(
      folioFinding(
        reservation,
        `article=${articleCode}; unlinked canonical count=${lines.length}; classifiable legacy prefix count=${prefixCount}; line ids: ${lines.map((line) => line.id).join(", ")}`,
      ),
    );
  }

  const fbDinnerLines = folio.lineItems.filter(
    (line) => line.article.code === "DINNER" && line.fbOrderId !== null,
  );
  for (const line of fbDinnerLines) {
    classes.get(9)?.findings.push(
      folioFinding(
        reservation,
        `line id=${line.id}; fbOrderId=${line.fbOrderId}; description=${JSON.stringify(line.description)}`,
      ),
    );
  }

  const nonDinnerFbCanonicalLines = folio.lineItems.filter(
    (line) =>
      line.reservationNightId === null &&
      line.fbOrderId !== null &&
      line.article.code !== "DINNER" &&
      canonicalArticleCodes.has(line.article.code),
  );
  for (const line of nonDinnerFbCanonicalLines) {
    manualCanonicalByArticle.set(line.article.code, [
      ...(manualCanonicalByArticle.get(line.article.code) ?? []),
      line,
    ]);
  }

  for (const [articleCode, lines] of manualCanonicalByArticle) {
    classes.get(10)?.findings.push(
      folioFinding(
        reservation,
        `article=${articleCode}; ${lines.length} line(s) cannot be a nightly prefix for arrangement ${reservation.arrangementType} with ${expectedDates.length} night(s); line ids: ${lines.map((line) => line.id).join(", ")}`,
      ),
    );
  }

  const linkedLines = folio.lineItems.filter(
    (line) => line.reservationNightId !== null,
  );
  if (linkedLines.length > 0) {
    const linkedViolations: string[] = [];
    const linkedByArticle = new Map<string, ScannedLineItem[]>();

    for (const line of linkedLines) {
      if (line.fbOrderId !== null || !applicableCodes.has(line.article.code)) {
        linkedViolations.push(
          `line ${line.id} links non-nightly article/origin ${line.article.code} (fbOrderId=${line.fbOrderId ?? "null"})`,
        );
        continue;
      }

      if (line.reservationNight?.reservationId !== reservation.id) {
        continue;
      }

      if (line.article.code === ROOM_CHARGE_ARTICLE_CODE) {
        linkedViolations.push(
          ...linkedRoomChargeShapeIssues({
            id: line.id,
            fbOrderId: line.fbOrderId,
            reservationNightId: line.reservationNightId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.amount,
            reservationNightRateAmount: line.reservationNight.rateAmount,
            serviceDate: line.reservationNight.date,
          }),
        );
      }

      linkedByArticle.set(line.article.code, [
        ...(linkedByArticle.get(line.article.code) ?? []),
        line,
      ]);
    }

    for (const [articleCode, lines] of linkedByArticle) {
      const prefixLength = classifiedPrefixByArticle.get(articleCode)?.length ?? 0;
      const indices = lines
        .map((line) =>
          line.reservationNight
            ? expectedDateIndex.get(dateKey(line.reservationNight.date))
            : undefined,
        )
        .filter((index): index is number => index !== undefined)
        .sort((a, b) => a - b);
      const expectedIndices = indices.map((_, offset) => prefixLength + offset);

      if (
        indices.length !== lines.length ||
        indices.some((index, offset) => index !== expectedIndices[offset])
      ) {
        linkedViolations.push(
          `article=${articleCode} has legacy prefix count=${prefixLength} and linked schedule indices=[${indices.join(", ")}], expected contiguous suffix indices=[${expectedIndices.join(", ")}]`,
        );
      }
    }

    if (linkedViolations.length > 0) {
      classes.get(11)?.findings.push(
        folioFinding(reservation, linkedViolations.join("; ")),
      );
    }
  }

  const foreignOwnedLines = linkedLines.filter(
    (line) => line.reservationNight?.reservationId !== reservation.id,
  );
  if (foreignOwnedLines.length > 0) {
    classes.get(12)?.findings.push(
      folioFinding(
        reservation,
        `line(s) point to nights owned by another reservation: ${foreignOwnedLines
          .map(
            (line) =>
              `line ${line.id} -> night ${line.reservationNightId} (reservationId=${line.reservationNight?.reservationId ?? "missing"})`,
          )
          .join(", ")}`,
      ),
    );
  }
}

function addGlobalDuplicatePairFindings(
  reservations: ScannedReservation[],
  classes: Map<number, FindingClass>,
) {
  const pairGroups = new Map<
    string,
    Array<{ reservation: ScannedReservation; line: ScannedLineItem }>
  >();

  for (const reservation of reservations) {
    for (const line of reservation.folio?.lineItems ?? []) {
      if (line.reservationNightId === null) {
        continue;
      }

      const key = `${line.reservationNightId}:${line.articleId}`;
      pairGroups.set(key, [
        ...(pairGroups.get(key) ?? []),
        { reservation, line },
      ]);
    }
  }

  for (const entries of pairGroups.values()) {
    if (entries.length < 2) {
      continue;
    }

    const first = entries[0];
    classes.get(7)?.findings.push({
      reservationId: first.reservation.id,
      reservationNo: first.reservation.reservationNo,
      folioId: first.reservation.folio?.id,
      folioNo: first.reservation.folio?.folioNo,
      description: `duplicate pair reservationNightId=${first.line.reservationNightId}, articleId=${first.line.articleId}; affected lines: ${entries
        .map(
          ({ reservation, line }) =>
            `${reservation.reservationNo}/${reservation.folio?.folioNo ?? "no-folio"}/line-${line.id}`,
        )
        .join(", ")}`,
    });
  }
}

function printReport(
  reservations: ScannedReservation[],
  findingClasses: FindingClass[],
) {
  const folioCount = reservations.filter((reservation) => reservation.folio).length;
  const nightCount = reservations.reduce(
    (sum, reservation) => sum + reservation.reservationNights.length,
    0,
  );
  const lineCount = reservations.reduce(
    (sum, reservation) => sum + (reservation.folio?.lineItems.length ?? 0),
    0,
  );

  console.log("Nightly Posting Readiness Reconciliation (READ-ONLY)");
  console.log("=====================================================");
  console.log(`Scope: reservation status in ${CUTOVER_STATUSES.join(", ")}`);
  console.log(
    `Scanned: ${reservations.length} reservation(s), ${folioCount} folio(s), ${nightCount} ReservationNight row(s), ${lineCount} FolioLineItem row(s)`,
  );
  console.log("");

  for (const findingClass of findingClasses) {
    console.log(
      `${findingClass.number}. ${findingClass.name} [${findingClass.disposition}]`,
    );
    console.log(`Count: ${findingClass.findings.length}`);

    if (findingClass.findings.length === 0) {
      console.log("- none");
    } else {
      for (const finding of findingClass.findings) {
        console.log(`- ${identifier(finding)} — ${finding.description}`);
      }
    }
    console.log("");
  }

  const blockingClasses = findingClasses.filter(
    (findingClass) =>
      BLOCKING_CLASS_NUMBERS.has(findingClass.number) &&
      findingClass.findings.length > 0,
  );

  console.log("GO / NO-GO SUMMARY");
  console.log("==================");
  if (blockingClasses.length === 0) {
    console.log("GO — no blocking reconciliation anomalies were found.");
    console.log(
      "Expected/benign observations: class 5 reports activated variable nightly pricing; class 8 is the legacy unlinked nightly prefix to preserve during cutover; class 9 is F&B-origin DINNER intentionally excluded from inclusion counts.",
    );
  } else {
    console.log("NO-GO — reconcile these blocking classes before Phase 5c:");
    for (const findingClass of blockingClasses) {
      console.log(
        `- ${findingClass.number}. ${findingClass.name}: ${findingClass.findings.length} affected record/group(s)`,
      );
    }
    process.exitCode = 1;
  }

  console.log(
    "Read-only guarantee: this scanner only executes Prisma findMany queries and performs no create/update/delete/upsert/raw-write operations.",
  );
}

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: [...CUTOVER_STATUSES] } },
    ...reservationSelection,
    orderBy: { id: "asc" },
  });

  const findingClasses: FindingClass[] = [
    { number: 1, name: "MISSING SCHEDULE", disposition: "BLOCKING", findings: [] },
    { number: 2, name: "PARTIAL/NON-CONTIGUOUS SCHEDULE", disposition: "BLOCKING", findings: [] },
    { number: 3, name: "OUT-OF-RANGE NIGHTS", disposition: "BLOCKING", findings: [] },
    { number: 4, name: "FRACTIONAL/NEGATIVE RATES", disposition: "BLOCKING", findings: [] },
    { number: 5, name: "VARIABLE NIGHTLY RATES", disposition: "EXPECTED / INFORMATIONAL", findings: [] },
    { number: 6, name: "OVER-POSTED", disposition: "BLOCKING", findings: [] },
    { number: 7, name: "EXISTING NON-NULL DUPLICATE (reservationNightId, articleId)", disposition: "BLOCKING", findings: [] },
    { number: 8, name: "UNLINKED CANONICAL STAY-CHARGE LINES", disposition: "EXPECTED / INFORMATIONAL", findings: [] },
    { number: 9, name: "F&B-ORIGIN DINNER", disposition: "EXPECTED / INFORMATIONAL", findings: [] },
    { number: 10, name: "MANUAL CANONICAL-ARTICLE LINES", disposition: "BLOCKING", findings: [] },
    { number: 11, name: "LINKED-PREFIX VALIDITY", disposition: "BLOCKING", findings: [] },
    { number: 12, name: "OWNERSHIP", disposition: "BLOCKING", findings: [] },
    { number: 13, name: "SCALAR/FIRST-NIGHT MISMATCH", disposition: "BLOCKING", findings: [] },
  ];
  const classes = new Map(
    findingClasses.map((findingClass) => [findingClass.number, findingClass]),
  );

  for (const reservation of reservations) {
    addScheduleFindings(reservation, classes);
    addLineItemFindings(reservation, classes);
  }
  addGlobalDuplicatePairFindings(reservations, classes);

  printReport(reservations, findingClasses);
}

main()
  .catch((error) => {
    console.error("Nightly posting readiness scan failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
