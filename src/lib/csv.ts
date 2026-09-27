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

export function formatCsvRow<T>(columns: CsvColumn<T>[], row: T): string {
  return columns.map((column) => escapeCsvValue(column.accessor(row))).join(",");
}

export function formatCsvChunk<T>(columns: CsvColumn<T>[], rows: T[]): string {
  // Prefix separators to preserve generateCsv's output without a trailing CRLF.
  return rows.map((row) => `\r\n${formatCsvRow(columns, row)}`).join("");
}

export function createStreamingCsvResponse<T>(options: {
  filename: string;
  columns: CsvColumn<T>[];
  streamRows: (enqueue: (chunk: string) => void) => Promise<void>;
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const header = options.columns.map((column) => escapeCsvValue(column.header)).join(",");
        controller.enqueue(encoder.encode(`\uFEFF${header}`));
        await options.streamRows((chunk) => controller.enqueue(encoder.encode(chunk)));
      } catch (error) {
        controller.error(error);
      } finally {
        try {
          controller.close();
        } catch {
          // An errored or cancelled stream is already closed to further writes.
        }
      }
    },
  });
  const safeFilename = options.filename.replace(/["\r\n]/g, "_");

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export function generateCsv<T>(
  columns: CsvColumn<T>[],
  rows: T[],
): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  return `\uFEFF${header}${formatCsvChunk(columns, rows)}`;
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
