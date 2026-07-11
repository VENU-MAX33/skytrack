interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ total, page, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#E0E4E9]">
      <span className="text-[12px] text-[#595959]">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1 rounded border border-[#E0E4E9] text-[12px] text-[#222222] hover:bg-[#F5F6FA] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-[#595959] text-[12px]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`px-3 py-1 rounded border text-[12px] ${
                p === page
                  ? 'bg-[#0047B2] text-white border-[#0047B2]'
                  : 'border-[#E0E4E9] text-[#222222] hover:bg-[#F5F6FA]'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1 rounded border border-[#E0E4E9] text-[12px] text-[#222222] hover:bg-[#F5F6FA] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
