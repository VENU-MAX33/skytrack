import { useState } from "react";
import { Link } from "react-router-dom";
import Pagination from "./Pagination";
import { StatIcon } from "../lib/statIcons";

interface Column {
  key: string;
  header: string;
  width?: string;
}

interface DataTableProps {
  title: string;
  columns: Column[];
  data: object[];
  showPagination?: boolean;
  pageSize?: number;
  titleTo?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export default function DataTable({
  title,
  columns,
  data,
  showPagination = true,
  pageSize = 5,
  titleTo,
  onRowClick,
}: DataTableProps) {
  const [page, setPage] = useState(1);
  const pageData = showPagination
    ? data.slice((page - 1) * pageSize, page * pageSize)
    : data;

  return (
    <div className="dashboard-card">
      <div className="p-3 border-b border-[#E0E4E9] flex justify-between items-center">
        {titleTo ? (
          <Link
            to={titleTo}
            className="text-[14px] font-semibold text-[#222222] hover:text-[#0047B2] hover:underline flex items-center gap-2"
          >
            <StatIcon label={title} />
            {title}
          </Link>
        ) : (
          <h3 className="text-[14px] font-semibold text-[#222222] flex items-center gap-2">
            <StatIcon label={title} />
            {title}
          </h3>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-[12px] font-semibold text-[#222222] bg-[#F5F6FA] px-3 py-2 text-left border-b border-[#E0E4E9]"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-[12px] text-[#595959] px-3 py-4 text-center"
                >
                  No records
                </td>
              </tr>
            ) : (
              pageData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={onRowClick ? () => onRowClick(row as Record<string, unknown>) : undefined}
                  className={`hover:bg-[#F5F6FA] ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="text-[12px] text-[#222222] px-3 py-2 border-b border-[#E0E4E9]"
                    >
                      {String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {showPagination && (
        <Pagination total={data.length} page={page} pageSize={pageSize} onChange={setPage} />
      )}
    </div>
  );
}
