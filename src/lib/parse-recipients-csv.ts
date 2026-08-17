export const PHONE_COLUMN = "phone";
export const MISSING_PHONE_COLUMN = "CSV must include a phone column";
export const PHONE_NUMBER_RENAME_HINT =
  'CSV must include a phone column (found "phone_number" — rename it to "phone")';

export type RecipientRow = {
  id: string;
  values: Record<string, string>;
};

export type RecipientsAnalysis = {
  people: number;
  dataRowCount: number;
  emptyCells: Record<string, number>;
  skippedEmptyPhone: number;
};

export type RecipientsCsvResult =
  | {
      ok: true;
      columns: string[];
      rows: Record<string, string>[];
      emptyCells: Record<string, number>;
      skippedEmptyPhone: number;
    }
  | { ok: false; error: string };

export function newRecipientId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function emptyRecipientRow(columns: string[]): RecipientRow {
  return {
    id: newRecipientId(),
    values: Object.fromEntries(columns.map((col) => [col, ""])),
  };
}

export function isBlankRecipient(row: RecipientRow, columns: string[]): boolean {
  return columns.every((col) => !row.values[col]?.trim());
}

export function analyzeRecipients(columns: string[], rows: RecipientRow[]): RecipientsAnalysis {
  const dataRows = rows.filter((row) => !isBlankRecipient(row, columns));
  const emptyCells = Object.fromEntries(columns.map((col) => [col, 0]));
  let people = 0;
  let skippedEmptyPhone = 0;
  for (const row of dataRows) {
    for (const col of columns) {
      if (!row.values[col]?.trim()) emptyCells[col] += 1;
    }
    if (row.values[PHONE_COLUMN]?.trim()) people += 1;
    else skippedEmptyPhone += 1;
  }
  return { people, dataRowCount: dataRows.length, emptyCells, skippedEmptyPhone };
}

function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      if (cell.endsWith("\r")) cell = cell.slice(0, -1);
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

export function parseRecipientsCsv(text: string): RecipientsCsvResult {
  const table = parseCsvTable(text);
  if (table.length === 0) return { ok: false, error: MISSING_PHONE_COLUMN };

  const rawHeaders = table[0].map((h) => h.trim());
  if (!rawHeaders.some(Boolean)) return { ok: false, error: MISSING_PHONE_COLUMN };

  const phoneIndex = rawHeaders.findIndex((h) => h.toLowerCase() === PHONE_COLUMN);
  if (phoneIndex < 0) {
    const hasPhoneNumber = rawHeaders.some((h) => h.toLowerCase() === "phone_number");
    return { ok: false, error: hasPhoneNumber ? PHONE_NUMBER_RENAME_HINT : MISSING_PHONE_COLUMN };
  }

  const extra: string[] = [];
  const extraIndex = new Map<string, number>();
  rawHeaders.forEach((header, index) => {
    if (!header || index === phoneIndex || header.toLowerCase() === PHONE_COLUMN) return;
    if (!extraIndex.has(header)) {
      extraIndex.set(header, index);
      extra.push(header);
    }
  });

  const columns = [PHONE_COLUMN, ...extra];
  const emptyCells = Object.fromEntries(columns.map((col) => [col, 0]));
  const rows: Record<string, string>[] = [];
  let skippedEmptyPhone = 0;

  for (const line of table.slice(1)) {
    const values: Record<string, string> = { [PHONE_COLUMN]: (line[phoneIndex] ?? "").trim() };
    for (const col of extra) {
      values[col] = (line[extraIndex.get(col) ?? -1] ?? "").trim();
    }
    if (!columns.some((col) => values[col])) continue;
    for (const col of columns) {
      if (!values[col]) emptyCells[col] += 1;
    }
    if (!values[PHONE_COLUMN]) skippedEmptyPhone += 1;
    rows.push(values);
  }

  return { ok: true, columns, rows, emptyCells, skippedEmptyPhone };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function recipientsToCsvFile(columns: string[], rows: RecipientRow[]): File {
  const dataRows = rows.filter((row) => row.values[PHONE_COLUMN]?.trim());
  const lines = [
    columns.join(","),
    ...dataRows.map((row) => columns.map((col) => csvEscape(row.values[col] ?? "")).join(",")),
  ];
  return new File([lines.join("\n")], "recipients.csv", { type: "text/csv" });
}
