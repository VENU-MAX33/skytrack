import * as XLSX from 'xlsx';

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
}

export interface WorkbookTemplateSheet {
  name: string;
  headers: string[];
  example?: Record<string, string>;
}

function headerKey(value: unknown): string {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function displayCell(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function parseSheet<T extends ExcelRow>(
  name: string,
  sheet: XLSX.WorkSheet,
  aliases: Record<string, string> = {},
): ParsedSheet<T> | null {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
    dateNF: 'yyyy-mm-dd',
  });
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
    const row: ExcelRow = {};
    headers.forEach((header, index) => { row[header] = displayCell(values[index]); });
    rows.push(row as T);
  }
  return { name, headers, headerRow: headerIndex + 1, rows };
}

function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read the selected Excel file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseWorkbook(
  file: File,
  options: ParseExcelOptions = {},
): Promise<ParsedSheet[]> {
  const buffer = await readFile(file);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const preferred = options.sheetName
    ? [options.sheetName, ...workbook.SheetNames.filter((name) => name !== options.sheetName)]
    : workbook.SheetNames;
  const sheets: ParsedSheet[] = [];
  for (const name of preferred) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const parsed = parseSheet(name, sheet, options.aliases);
    if (parsed) sheets.push(parsed);
  }
  return sheets;
}

export async function parseExcel<T extends ExcelRow>(
  file: File,
  options: ParseExcelOptions = {},
): Promise<T[]> {
  const sheets = await parseWorkbook(file, options);
  return (sheets.find((sheet) => sheet.rows.length > 0)?.rows ?? []) as T[];
}

export function exportToExcel(filename: string, data: Record<string, unknown>[]): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename);
}

export function downloadWorkbookTemplate(filename: string, sheets: WorkbookTemplateSheet[]): void {
  const workbook = XLSX.utils.book_new();
  for (const definition of sheets) {
    const matrix: string[][] = [definition.headers];
    if (definition.example) matrix.push(definition.headers.map((header) => definition.example?.[header] ?? ''));
    const sheet = XLSX.utils.aoa_to_sheet(matrix);
    sheet['!cols'] = definition.headers.map((header) => ({ wch: Math.max(14, header.length + 2) }));
    XLSX.utils.book_append_sheet(workbook, sheet, definition.name.slice(0, 31));
  }
  XLSX.writeFile(workbook, filename);
}

export function downloadTemplate(
  filename: string,
  headers: string[],
  example?: Record<string, string>,
): void {
  downloadWorkbookTemplate(filename, [{ name: 'Data', headers, example }]);
}
