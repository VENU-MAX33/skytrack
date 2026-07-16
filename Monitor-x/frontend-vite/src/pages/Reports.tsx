import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Bus, User, Car, Users, Siren } from "lucide-react";
import { getTripReport, getGenericReport, downloadReport } from "../api/reports";
import type { ReportPeriod, ReportSummary, ReportType, GenericReport } from "../api/types";
import { useToast } from "../context/ToastContext";
import DataTable from "../components/DataTable";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const REPORT_TABS: { key: ReportType; label: string; icon: React.ReactNode; dated: boolean }[] = [
  { key: "trips", label: "Trips", icon: <Bus className="w-4 h-4" />, dated: true },
  { key: "drivers", label: "Drivers", icon: <User className="w-4 h-4" />, dated: false },
  { key: "cabs", label: "Cabs", icon: <Car className="w-4 h-4" />, dated: false },
  { key: "employees", label: "Employees", icon: <Users className="w-4 h-4" />, dated: false },
  { key: "sos", label: "SOS Alerts", icon: <Siren className="w-4 h-4" />, dated: true },
];

const TRIP_COLUMNS = [
  { key: "id", header: "Trip ID" },
  { key: "date", header: "Date" },
  { key: "type", header: "Type" },
  { key: "shiftTime", header: "Shift" },
  { key: "status", header: "Status" },
  { key: "route", header: "Route" },
  { key: "vehicleNo", header: "Vehicle" },
  { key: "vendor", header: "Vendor" },
  { key: "driverName", header: "Driver" },
  { key: "empCount", header: "Employees" },
  { key: "verifiedCount", header: "Verified" },
];

// Table columns per generic report type (subset of CSV columns, kept readable on screen).
const GENERIC_COLUMNS: Record<Exclude<ReportType, "trips">, { key: string; header: string }[]> = {
  drivers: [
    { key: "name", header: "Name" }, { key: "contact", header: "Contact" },
    { key: "vendor", header: "Vendor" }, { key: "dlNumber", header: "DL Number" },
    { key: "dlExpiry", header: "DL Expiry" }, { key: "badgeNumber", header: "Badge" },
    { key: "pvcExpiry", header: "PVC Expiry" }, { key: "medicalExpiry", header: "Medical Expiry" },
    { key: "active", header: "Active" },
  ],
  cabs: [
    { key: "rtoNo", header: "Vehicle No" }, { key: "model", header: "Model" },
    { key: "vehicleType", header: "Type" }, { key: "seatCount", header: "Seats" },
    { key: "vendor", header: "Vendor" }, { key: "driverName", header: "Driver" },
    { key: "insuranceEnd", header: "Insurance End" }, { key: "fcExpiry", header: "FC Expiry" },
    { key: "active", header: "Active" },
  ],
  employees: [
    { key: "empId", header: "Emp ID" }, { key: "name", header: "Name" },
    { key: "contact", header: "Contact" }, { key: "route", header: "Route" },
    { key: "location", header: "Location" }, { key: "nodalPoint", header: "Nodal Point" },
    { key: "shiftLogin", header: "Shift In" }, { key: "shiftLogout", header: "Shift Out" },
    { key: "active", header: "Active" },
  ],
  sos: [
    { key: "raisedAt", header: "Raised At" }, { key: "empId", header: "Emp ID" },
    { key: "empName", header: "Employee" }, { key: "tripId", header: "Trip" },
    { key: "driverName", header: "Driver" }, { key: "location", header: "Location" },
    { key: "reason", header: "Reason" }, { key: "status", header: "Status" },
    { key: "acknowledgedBy", header: "Ack. By" },
  ],
};

export default function Reports() {
  const toast = useToast();
  const [reportType, setReportType] = useState<ReportType>("trips");
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [generic, setGeneric] = useState<GenericReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const activeTab = REPORT_TABS.find((t) => t.key === reportType)!;
  const effectiveDate =
    period === "monthly" ? `${month}-01` : period === "yearly" ? `${year}-01-01` : date;

  const load = useCallback(() => {
    setLoading(true);
    if (reportType === "trips") {
      getTripReport(period, effectiveDate)
        .then((s) => { setSummary(s); setGeneric(null); })
        .catch((err: Error) => toast.error(`Failed to load report: ${err.message}`))
        .finally(() => setLoading(false));
    } else {
      getGenericReport(reportType, period, effectiveDate)
        .then((g) => { setGeneric(g); setSummary(null); })
        .catch((err: Error) => toast.error(`Failed to load report: ${err.message}`))
        .finally(() => setLoading(false));
    }
  }, [reportType, period, effectiveDate, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rowCount = reportType === "trips" ? summary?.trips.length ?? 0 : generic?.count ?? 0;
  const label = reportType === "trips" ? summary?.label : generic?.label;

  async function handleDownload() {
    setDownloading(true);
    try {
      const suffix = activeTab.dated ? `${period}-${(label ?? "").replace(/\s+/g, "_")}` : "all";
      await downloadReport(reportType, period, effectiveDate, `${reportType}-report-${suffix}.csv`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download report");
    } finally {
      setDownloading(false);
    }
  }

  const statCards = summary
    ? [
        { label: "Total Trips", value: summary.totals.trips },
        { label: "Completed", value: summary.totals.completed },
        { label: "In Progress", value: summary.totals.inProgress },
        { label: "Not Started", value: summary.totals.notStarted },
        { label: "Cancelled", value: summary.totals.cancelled },
        { label: "Employees Transported", value: summary.totals.employeesTransported },
      ]
    : [];

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Reports</h1>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || loading || rowCount === 0}
          className="flex items-center gap-2 bg-[#0047B2] text-white px-4 py-2 rounded text-[13px] hover:bg-[#003a91] disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {downloading ? "Downloading…" : "Download CSV"}
        </button>
      </div>

      {/* Report type tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E0E4E9] flex-wrap">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setReportType(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
              reportType === t.key
                ? "border-[#0047B2] text-[#0047B2]"
                : "border-transparent text-[#595959] hover:text-[#222]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Period + date selectors (only for dated reports) */}
      {activeTab.dated ? (
        <div className="dashboard-card p-4 mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 text-[13px] font-medium rounded transition-colors ${
                  period === p.key
                    ? "bg-[#0047B2] text-white"
                    : "bg-[#F5F6FA] text-[#555555] hover:bg-[#ECF0F5]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(period === "daily" || period === "weekly") && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          )}
          {period === "monthly" && (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"
            />
          )}
          {period === "yearly" && (
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px] w-24"
            />
          )}

          {(summary || generic) && (
            <span className="text-[12px] text-[#595959]">
              Showing {reportType === "trips" ? `${summary?.from} to ${summary?.to}` : `${generic?.from} to ${generic?.to}`}
              {" · "}{rowCount} records
            </span>
          )}
        </div>
      ) : (
        <div className="dashboard-card p-4 mb-4 text-[12px] text-[#595959]">
          Full {activeTab.label.toLowerCase()} master list — {rowCount} records
        </div>
      )}

      {loading ? (
        <div className="dashboard-card p-10 text-center text-[#595959] text-[14px]">Loading report…</div>
      ) : reportType === "trips" && summary ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {statCards.map((s) => (
              <div key={s.label} className="dashboard-card p-4">
                <div className="text-[12px] text-[#595959] mb-1">{s.label}</div>
                <div className="text-[20px] font-semibold text-[#0047B2]">{s.value}</div>
              </div>
            ))}
          </div>

          {summary.vendorBreakdown.length > 0 && (
            <div className="dashboard-card p-4 mb-4">
              <h3 className="text-[14px] font-semibold text-[#222222] mb-3">Vendor Performance</h3>
              <div className="grid grid-cols-3 gap-3">
                {summary.vendorBreakdown.map((v) => (
                  <div key={v.vendor} className="bg-[#F9F9F9] rounded p-3">
                    <div className="text-[12px] text-[#222222] font-medium mb-1">{v.vendor}</div>
                    <div className="text-[11px] text-[#595959]">
                      {v.completed}/{v.trips} completed
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DataTable
            title={`Trips — ${summary.label}`}
            columns={TRIP_COLUMNS}
            data={summary.trips}
            pageSize={10}
          />
        </>
      ) : reportType !== "trips" && generic ? (
        <DataTable
          title={`${activeTab.label} — ${generic.label}`}
          columns={GENERIC_COLUMNS[reportType]}
          data={generic.rows}
          pageSize={10}
        />
      ) : null}
    </>
  );
}
