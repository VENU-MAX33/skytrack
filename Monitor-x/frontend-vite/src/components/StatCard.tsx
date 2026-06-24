import { useNavigate } from "react-router-dom";

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
      <h3 className="text-[14px] font-semibold text-[#222222] mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            onClick={stat.to ? () => navigate(stat.to!) : undefined}
            className={`bg-[#F9F9F9] rounded p-3 ${
              stat.to ? "cursor-pointer hover:bg-[#F0F4FA] transition-colors" : ""
            }`}
            role={stat.to ? "link" : undefined}
            title={stat.to ? `View ${stat.label}` : undefined}
          >
            <div className="text-[12px] text-[#777777] mb-1">{stat.label}</div>
            <div className="text-[20px] font-semibold text-[#0047B2]">{stat.value}</div>
            {stat.subLabel && (
              <div className="text-[11px] text-[#848484] mt-1">{stat.subLabel}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
