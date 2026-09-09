export interface CsvColumn<T> {
  header: string;
  accessor: (
    row: T,
  ) => string | number | boolean | Date | null | undefined;
}

const PLAIN_SIGNED_NUMBER_PATTERN =
  /^[+-](?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

function needsFormulaPrefix(value: string): boolean {
  if (/^[=@\t\r]/.test(value)) {
    return true;
  }

  if (!/^[+-]/.test(value) || value === "-") {
    return false;
  }

  return !PLAIN_SIGNED_NUMBER_PATTERN.test(value);
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const rawValue = value instanceof Date ? value.toISOString() : String(value);
  const safeValue = needsFormulaPrefix(rawValue) ? `'${rawValue}` : rawValue;

  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }

  return safeValue;
}

export function generateCsv<T>(
  columns: CsvColumn<T>[],
  rows: T[],
): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.accessor(row))).join(","),
  );

  return `\uFEFF${[header, ...dataRows].join("\r\n")}`;
}

export function createCsvResponse(
  csvContent: string,
  filename: string,
): Response {
  const safeFilename = filename.replace(/["\r\n]/g, "_");

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
