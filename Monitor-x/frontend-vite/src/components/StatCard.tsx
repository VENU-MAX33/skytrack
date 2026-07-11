import { useNavigate } from "react-router-dom";
import { StatIcon } from "../lib/statIcons";

interface StatItem {
  label: string;
  value: number;
  subLabel?: string;
  to?: string;
}

interface StatCardProps {
  title: string;
  stats: StatItem[];
  className?: string;
}

export default function StatCard({ title, stats, className = "" }: StatCardProps) {
  const navigate = useNavigate();
  return (
    <div className={`dashboard-card p-4 ${className}`}>
      <h3 className="text-[14px] font-semibold text-[#222222] mb-3 flex items-center gap-2">
        <StatIcon label={title} />
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => {
          const inner = (
            <>
              <div className="flex items-center gap-1.5 mb-1">
                <StatIcon label={stat.label} size={12} />
                <span className="text-[12px] text-[#595959]">{stat.label}</span>
              </div>
              <div className="text-[20px] font-semibold text-[#0047B2]">{stat.value}</div>
              {stat.subLabel && (
                <div className="text-[11px] text-[#848484] mt-1">{stat.subLabel}</div>
              )}
            </>
          );
          return stat.to ? (
            <button
              key={index}
              type="button"
              onClick={() => navigate(stat.to!)}
              aria-label={`View ${stat.label}`}
              className="bg-[#F9F9F9] rounded p-3 text-left w-full cursor-pointer hover:bg-[#F0F4FA] transition-colors"
            >
              {inner}
            </button>
          ) : (
            <div key={index} className="bg-[#F9F9F9] rounded p-3">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
