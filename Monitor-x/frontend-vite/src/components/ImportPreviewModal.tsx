import { FileSpreadsheet, Upload, X } from 'lucide-react';
import Modal from './Modal';
import type { ExcelRow } from '../lib/excel';

export interface ImportColumn {
  key: string;
  label?: string;
  required?: boolean;
  width?: string;
}

interface Props<T extends ExcelRow> {
  open: boolean;
  title: string;
  rows: T[];
  columns: ImportColumn[];
  errors: Record<number, string[]>;
  saving?: boolean;
  progress?: string;
  onRowsChange: (rows: T[]) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function ImportPreviewModal<T extends ExcelRow>({
  open,
  title,
  rows,
  columns,
  errors,
  saving = false,
  progress = '',
  onRowsChange,
  onClose,
  onSave,
}: Props<T>) {
  const invalidCount = Object.values(errors).filter((items) => items.length > 0).length;

  function update(rowIndex: number, key: string, value: string) {
    onRowsChange(rows.map((row, index) => index === rowIndex ? { ...row, [key]: value } : row));
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      title={title}
      panelClassName="w-[96vw] max-w-7xl max-h-[88vh] flex flex-col"
    >
      <div className="p-4 border-b border-[#E0E4E9] flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#18751C]" />
            <span className="text-[14px] font-semibold text-[#222]">{title}</span>
          </div>
          <div className="text-[11px] text-[#595959] mt-1">
            {rows.length} rows · {rows.length - invalidCount} ready · {invalidCount} need correction. Cells can be edited before saving.
          </div>
        </div>
        <button disabled={saving} onClick={onClose} className="text-[#595959] hover:text-[#222] disabled:opacity-50" aria-label="Close import preview">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-auto flex-1 p-4">
        <table className="min-w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#F5F6FA]">
              <th className="border border-[#E0E4E9] px-2 py-2 text-left">ROW</th>
              <th className="border border-[#E0E4E9] px-2 py-2 text-left">STATUS</th>
              {columns.map((column) => (
                <th key={column.key} className="border border-[#E0E4E9] px-2 py-2 text-left whitespace-nowrap">
                  {column.label ?? column.key}{column.required ? ' *' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowErrors = errors[index] ?? [];
              return (
                <tr key={index} className={rowErrors.length ? 'bg-[#FFF1F1]' : 'bg-[#F3FFF4]'}>
                  <td className="border border-[#E0E4E9] px-2 py-1 text-center">{index + 2}</td>
                  <td className="border border-[#E0E4E9] px-2 py-1 min-w-48">
                    {rowErrors.length ? (
                      <span className="text-[#B42318]">{rowErrors.join(' · ')}</span>
                    ) : (
                      <span className="text-[#18751C]">Ready</span>
                    )}
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className="border border-[#E0E4E9] p-1">
                      <input
                        value={row[column.key] ?? ''}
                        onChange={(event) => update(index, column.key, event.target.value)}
                        disabled={saving}
                        className={`border rounded px-2 py-1 min-w-32 ${column.width ?? ''} ${
                          column.required && !row[column.key]?.trim() ? 'border-[#D22630]' : 'border-[#D5D9DE]'
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[#E0E4E9] bg-[#F9F9F9] flex items-center justify-between gap-2">
        <span className={`text-[12px] ${invalidCount ? 'text-[#B42318]' : 'text-[#18751C]'}`}>
          {progress || (invalidCount ? `Correct ${invalidCount} invalid row${invalidCount === 1 ? '' : 's'} to continue` : 'All rows are ready to save')}
        </span>
        <div className="flex gap-2">
          <button disabled={saving} onClick={onClose} className="px-4 py-2 text-[13px] border border-[#E0E4E9] rounded hover:bg-white disabled:opacity-50">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving || invalidCount > 0 || rows.length === 0}
            className="px-4 py-2 text-[13px] text-white bg-[#18751C] rounded hover:bg-[#145a18] disabled:opacity-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {saving ? 'Saving…' : `Save ${rows.length} Rows`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
