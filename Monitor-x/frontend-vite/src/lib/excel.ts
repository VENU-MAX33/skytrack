import readXlsxFile, { type CellValue, type Sheet } from 'read-excel-file/browser';
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';

export type ExcelRow = Record<string, string>;

export interface ParsedSheet<T extends ExcelRow = ExcelRow> {
  name: string;
  headers: string[];
  headerRow: number;
  rows: T[];
}

export interface ParseExcelOptions {
  /** Canonical header aliases keyed by a case/spacing-insensitive label. */
  aliases?: Record<string, string>;
  /** Prefer this sheet, falling back to the first populated sheet. */
  sheetName?: string;
  /** Select the first populated sheet containing all of these headers. */
  requiredHeaders?: string[];
}

export interface WorkbookTemplateSheet {
  name: string;
  headers: string[];
  example?: Record<string, string>;
}

// Keep browser parsing bounded. The API has its own validation, but rejecting
// oversized workbooks before parsing prevents an attacker-controlled workbook
// from consuming excessive browser memory.
export const MAX_EXCEL_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_EXCEL_ROWS = 5_000;

function headerKey(value: unknown): string {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function displayCell(value: CellValue | null | undefined): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function parseSheet<T extends ExcelRow>(
  sheet: Sheet,
  aliases: Record<string, string> = {},
): ParsedSheet<T> | null {
  const matrix = sheet.data;
  if (matrix.length === 0) return null;

  const aliasMap = new Map<string, string>();
  for (const [alias, canonical] of Object.entries(aliases)) aliasMap.set(headerKey(alias), canonical);

  // Templates may contain an Instructions/title row. Pick the first row with
  // at least two populated cells, or the first non-empty row for one-column files.
  let headerIndex = matrix.findIndex((row) => row.filter((cell) => displayCell(cell) !== '').length >= 2);
  if (headerIndex < 0) headerIndex = matrix.findIndex((row) => row.some((cell) => displayCell(cell) !== ''));
  if (headerIndex < 0) return null;

  const headers = matrix[headerIndex].map((cell, index) => {
    const value = displayCell(cell);
    if (!value) return `Column ${index + 1}`;
    return aliasMap.get(headerKey(value)) ?? value.replace(/\s+/g, ' ');
  });

  const rows: T[] = [];
  for (const values of matrix.slice(headerIndex + 1)) {
    if (!values.some((cell) => displayCell(cell) !== '')) continue;
    if (rows.length >= MAX_EXCEL_ROWS) {
      throw new Error(`Excel file exceeds the ${MAX_EXCEL_ROWS.toLocaleString()} row limit`);
    }
    const row: ExcelRow = {};
    headers.forEach((header, index) => { row[header] = displayCell(values[index]); });
    rows.push(row as T);
  }
  return { name: sheet.sheet, headers, headerRow: headerIndex + 1, rows };
}

function assertWorkbookSize(file: File): void {
  if (file.size > MAX_EXCEL_FILE_BYTES) {
    throw new Error(`Excel file must be ${MAX_EXCEL_FILE_BYTES / (1024 * 1024)} MB or smaller`);
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Please upload an .xlsx workbook');
  }
}

export async function parseWorkbook(
  file: File,
  options: ParseExcelOptions = {},
): Promise<ParsedSheet[]> {
  assertWorkbookSize(file);
  const workbook = await readXlsxFile(file);
  const preferredNames = options.sheetName
    ? [options.sheetName, ...workbook.map((sheet) => sheet.sheet).filter((name) => name !== options.sheetName)]
    : workbook.map((sheet) => sheet.sheet);
  const sheets: ParsedSheet[] = [];
  for (const name of preferredNames) {
    const sheet = workbook.find((candidate) => candidate.sheet === name);
    if (!sheet) continue;
    const parsed = parseSheet(sheet, options.aliases);
    if (parsed) sheets.push(parsed);
  }
  return sheets;
}

export async function parseExcel<T extends ExcelRow>(
  file: File,
  options: ParseExcelOptions = {},
): Promise<T[]> {
  const sheets = await parseWorkbook(file, options);
  const required = new Set((options.requiredHeaders ?? []).map(headerKey));
  const matchingSheet = sheets.find((sheet) => {
    if (sheet.rows.length === 0) return false;
    if (required.size === 0) return true;
    const available = new Set(sheet.headers.map(headerKey));
    return [...required].every((header) => available.has(header));
  });
  return (matchingSheet?.rows ?? []) as T[];
}

function cell(value: unknown, style: Record<string, unknown> = {}) {
  return { value: value == null ? '' : String(value), type: String, ...style };
}

async function saveWorkbook(filename: string, sheets: SheetData[]): Promise<void> {
  const result = await writeXlsxFile(sheets.map((data, index) => ({
    data,
    sheet: index === 0 ? 'Data' : `Data ${index + 1}`,
    stickyRowsCount: 1,
  })));
  await result.toFile(filename);
}

export function exportToExcel(filename: string, data: Record<string, unknown>[]): void {
  const headers = [...new Set(data.flatMap((row) => Object.keys(row)))];
  const rows: SheetData = [
    headers.map((header) => cell(header, { fontWeight: 'bold', backgroundColor: '#EAF2FF' })),
    ...data.map((row) => headers.map((header) => cell(row[header]))),
  ];
  void saveWorkbook(filename, [rows]);
}

export function downloadWorkbookTemplate(filename: string, sheets: WorkbookTemplateSheet[]): void {
  const workbookSheets: SheetData[] = sheets.map((definition) => [
    definition.headers.map((header) => cell(header, { fontWeight: 'bold', backgroundColor: '#EAF2FF' })),
    ...(definition.example
      ? [definition.headers.map((header) => cell(definition.example?.[header] ?? ''))]
      : []),
  ]);
  const result = writeXlsxFile(sheets.map((definition, index) => ({
    data: workbookSheets[index],
    sheet: definition.name.slice(0, 31),
    stickyRowsCount: 1,
  })));
  void result.toFile(filename);
}

export function downloadTemplate(
  filename: string,
  headers: string[],
  example?: Record<string, string>,
): void {
  downloadWorkbookTemplate(filename, [{ name: 'Data', headers, example }]);
}
