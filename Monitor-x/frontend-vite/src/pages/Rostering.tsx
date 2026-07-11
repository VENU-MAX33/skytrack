import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Calendar, Search, Download, Upload, X, Check, MoreVertical } from "lucide-react";
import { getEmployees, getRosters, saveRosters, deleteRosters } from "../api";
import type { Employee, RosterEntry } from "../api";
import { useToast } from "../context/ToastContext";
import { localToday } from "../lib/tripStatus";

interface RosterConfig {
  empId: string;
  date: string;
  tripType: "pickup" | "drop" | "both";
  timing: string; // for pickup
  dropTiming?: string; // for drop
  rosterType: string;
}

const ROUTE_COLORS: Record<string, string> = {
  Blue: "#0047B2", Green: "#18751C", Red: "#D22630", Yellow: "#E6A817",
};

const todayStr = localToday;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateDisplay(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function Rostering() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [savedRosters, setSavedRosters] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");

  // rosterConfigs: empId -> date -> RosterConfig
  const [rosterConfigs, setRosterConfigs] = useState<Record<string, Record<string, RosterConfig>>>({});

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [fromDate, setFromDate] = useState(() => searchParams.get("date") ?? todayStr());
  const [toDate, setToDate] = useState(() => addDays(searchParams.get("date") ?? todayStr(), 7));
  const [teamFilter, setTeamFilter] = useState("All");
  const [activeTab, setActiveTab] = useState<"login" | "logout" | "both">("both");
  const [rosterType, setRosterType] = useState("normal");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMode, setShowMode] = useState<"all" | "selected">("all");

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; empId: string; date: string } | null>(null);
  const [timingModal, setTimingModal] = useState<{ empId: string; date: string } | null>(null);

  const [formTripType, setFormTripType] = useState<"pickup" | "drop" | "both">("both");
  const [formTiming, setFormTiming] = useState("09:00");
  const [formDropTiming, setFormDropTiming] = useState("18:00");

  useEffect(() => {
    setLoading(true);
    getEmployees().then(setEmployees).catch((err: Error) => toast.error(err.message)).finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    getRosters({ fromDate, toDate })
      .then(setSavedRosters)
      .catch((err: Error) => toast.error(err.message));
  }, [fromDate, toDate, toast]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (fromDate) params.date = fromDate;
    setSearchParams(params, { replace: true });
  }, [statusFilter, fromDate, setSearchParams]);

  // Handle URL passed selected employees (from Master Routing)
  useEffect(() => {
    const sel = searchParams.get("selected");
    if (sel) {
      setSelected(new Set(sel.split(",")));
      setShowMode("selected");
    }
  }, [searchParams]);

  const dates = useMemo(() => {
    const arr = [];
    let curr = new Date(fromDate);
    const end = new Date(toDate);
    while (curr <= end) {
      arr.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return arr;
  }, [fromDate, toDate]);

  // savedByEmpAndDate: empId -> date -> RosterEntry[]
  const savedByEmpAndDate = useMemo(() => {
    const map = new Map<string, Map<string, RosterEntry[]>>();
    savedRosters.forEach((r) => {
      if (!map.has(r.empId)) map.set(r.empId, new Map());
      const dateMap = map.get(r.empId)!;
      if (!dateMap.has(r.date)) dateMap.set(r.date, []);
      dateMap.get(r.date)!.push(r);
    });
    return map;
  }, [savedRosters]);

  const routedEmployees = useMemo(() => employees.filter((e) => e.route && e.route.trim() !== ""), [employees]);
  const teams = useMemo(() => ["All", ...Array.from(new Set(routedEmployees.map((e) => e.team).filter(Boolean)))], [routedEmployees]);

  const filtered = useMemo(() => {
    let list = routedEmployees;
    if (teamFilter !== "All") list = list.filter((e) => e.team === teamFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q));
    }
    if (showMode === "selected") list = list.filter((e) => selected.has(e.id));
    return list;
  }, [routedEmployees, teamFilter, searchQuery, showMode, selected]);

  const configuredCount = useMemo(() => {
    let c = 0;
    for (const empId in rosterConfigs) {
      c += Object.keys(rosterConfigs[empId]).length;
    }
    return c;
  }, [rosterConfigs]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = filtered.map((e) => e.id);
    const allSelected = allIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function handleContextMenu(e: React.MouseEvent, empId: string, date: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, empId, date });
  }

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  function handleSaveModal() {
    if (!timingModal) return;
    const { empId, date } = timingModal;
    setRosterConfigs((prev) => {
      const empConfigs = prev[empId] || {};
      return {
        ...prev,
        [empId]: {
          ...empConfigs,
          [date]: { empId, date, tripType: formTripType, timing: formTiming, dropTiming: formDropTiming, rosterType }
        }
      };
    });
    setTimingModal(null);
  }

  async function removeRoster(empId: string, date: string, type: "login" | "logout" | "both") {
    // Prune the local (unsaved) config first: partial removal keeps the other leg.
    setRosterConfigs((prev) => {
      const empConfigs = { ...prev[empId] };
      const cfg = empConfigs[date];
      if (cfg) {
        if (type === "both" || cfg.tripType === (type === "login" ? "pickup" : "drop")) {
          delete empConfigs[date];
        } else if (cfg.tripType === "both") {
          empConfigs[date] = {
            ...cfg,
            tripType: type === "login" ? "drop" : "pickup",
            timing: type === "login" ? (cfg.dropTiming ?? cfg.timing) : cfg.timing,
          };
        }
      }
      return { ...prev, [empId]: empConfigs };
    });

    // Then delete the SAVED shifts on the server (login→pickup, logout→drop).
    const tripType = type === "login" ? "pickup" : type === "logout" ? "drop" : "both";
    try {
      const { deleted } = await deleteRosters(empId, date, tripType);
      if (deleted > 0) {
        setSavedRosters(await getRosters({ fromDate, toDate }));
        toast.success(`Removed ${type} shift for ${formatDateDisplay(date)} (${deleted} deleted)`);
      } else {
        toast.success(`Removed ${type} for ${formatDateDisplay(date)}`);
      }
    } catch (err) {
      toast.error(`Could not remove shift: ${(err as Error).message}`);
    }
  }

  async function handleSaveAll() {
    if (configuredCount === 0) {
      toast.error("Configure at least one roster entry before saving.");
      return;
    }
    setSaving(true);
    try {
      const payloads: any[] = [];
      for (const empId in rosterConfigs) {
        for (const date in rosterConfigs[empId]) {
          const cfg = rosterConfigs[empId][date];
          if (cfg.tripType === "pickup" || cfg.tripType === "both") {
            payloads.push({ empId, date, tripType: "pickup", timing: cfg.timing, rosterType: cfg.rosterType, status: "pending" });
          }
          if (cfg.tripType === "drop" || cfg.tripType === "both") {
            payloads.push({ empId, date, tripType: "drop", timing: cfg.tripType === "both" ? cfg.dropTiming : cfg.timing, rosterType: cfg.rosterType, status: "pending" });
          }
        }
      }
      const saved = await saveRosters(payloads);
      toast.success(`Saved ${saved.length} roster entries`);
      setRosterConfigs({});
      getRosters({ fromDate, toDate }).then(setSavedRosters);
    } catch (err) {
      toast.error(`Could not save rosters: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#0047B2]" />
          <h1 className="text-[18px] font-semibold text-[#222222]">Rostering</h1>
          <div className="flex gap-2 ml-4">
            <span className="bg-[#0047B2] text-white px-3 py-1 rounded text-[12px]">Routed Employees <b>{routedEmployees.length}</b></span>
            {configuredCount > 0 && <span className="bg-[#E6A817] text-white px-3 py-1 rounded text-[12px]">Unsaved <b>{configuredCount}</b></span>}
          </div>
        </div>
      </div>

      <div className="dashboard-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="roster-from" className="text-[13px] text-[#595959]">From</label>
            <input id="roster-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="roster-to" className="text-[13px] text-[#595959]">To</label>
            <input id="roster-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="roster-teams" className="text-[13px] text-[#595959]">Teams</label>
            <select id="roster-teams" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]">
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="bg-[#0047B2] text-white px-4 py-2 rounded text-[13px]">Roster</button>
          <button onClick={handleSaveAll} disabled={saving} className="bg-[#18751C] text-white px-4 py-2 rounded text-[13px] disabled:opacity-50">Save</button>
          
          <div className="flex items-center gap-1 ml-4 border rounded border-[#E0E4E9] overflow-hidden">
            {(["login", "logout", "both"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-[13px] capitalize ${activeTab === tab ? "bg-[#0047B2] text-white" : "bg-white text-[#595959]"}`}>{tab}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-card p-4 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label className="text-[13px] flex items-center gap-2">
            <input type="checkbox" checked={showMode === "all"} onChange={() => setShowMode("all")} /> Show All Employees
          </label>
          <label className="text-[13px] flex items-center gap-2">
            <input type="checkbox" checked={showMode === "selected"} onChange={() => setShowMode("selected")} /> Show selected Employees
          </label>
          <button onClick={() => setSelected(new Set())} className="bg-[#0047B2] text-white px-3 py-1 rounded text-[12px]">Clear Check</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#595959] absolute left-2 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border border-[#E0E4E9] rounded pl-8 pr-3 py-1.5 text-[13px] w-64" />
          </div>
          <button className="text-[13px] border px-3 py-1.5 rounded flex items-center gap-1"><Download className="w-4 h-4"/> Import/Export</button>
        </div>
      </div>

      <div className="dashboard-card overflow-x-auto">
        <table className="w-full text-[13px] text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#E0E4E9] bg-[#F5F6FA]">
              <th className="p-3 w-10">
                <input type="checkbox" checked={filtered.length > 0 && filtered.every(e => selected.has(e.id))} onChange={toggleSelectAll} />
              </th>
              <th className="p-3 font-medium whitespace-nowrap">NAME</th>
              <th className="p-3 font-medium whitespace-nowrap">EMP ID</th>
              {dates.map(d => (
                <th key={d} className="p-3 font-medium text-center whitespace-nowrap border-l border-[#E0E4E9]">{formatDateDisplay(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3 + dates.length} className="text-center p-8">Loading...</td></tr>
            ) : filtered.map(emp => (
              <tr key={emp.id} className="border-b border-[#E0E4E9] hover:bg-[#F9F9F9]">
                <td className="p-3"><input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)} /></td>
                <td className="p-3 whitespace-nowrap">{emp.name}</td>
                <td className="p-3">{emp.id}</td>
                {dates.map(date => {
                  const cfg = rosterConfigs[emp.id]?.[date];
                  const saved = savedByEmpAndDate.get(emp.id)?.get(date);
                  let display = "";
                  let bgColor = "";
                  let textColor = "#222222";

                  if (cfg) {
                    if (cfg.tripType === "both") display = `${cfg.timing} | ${cfg.dropTiming}`;
                    else display = cfg.timing;
                    bgColor = "#E8F4FD"; // Unsaved config
                  } else if (saved && saved.length > 0) {
                    const pickups = saved.filter((s) => s.tripType === 'pickup');
                    const drops = saved.filter((s) => s.tripType === 'drop');
                    if (pickups.length && drops.length) {
                      display = `${pickups[0].shiftTime || 'Login'} | ${drops[0].shiftTime || 'Logout'}`;
                    } else if (pickups.length) {
                      display = pickups[0].shiftTime || 'Login';
                    } else if (drops.length) {
                      display = drops[0].shiftTime || 'Logout';
                    }
                    bgColor = "#F4F0FF"; // Saved
                  }

                  return (
                    <td 
                      key={date} 
                      className="p-1 border-l border-[#E0E4E9] cursor-context-menu relative"
                      onContextMenu={(e) => handleContextMenu(e, emp.id, date)}
                      onClick={(e) => {
                        // Allow click to also open the context menu or modal
                        // Let's just open modal on left click if empty, or context menu
                        setTimingModal({ empId: emp.id, date });
                      }}
                    >
                      <div 
                        className="w-full h-full min-h-[30px] rounded flex items-center justify-center text-[12px] px-1 font-medium whitespace-nowrap"
                        style={{ backgroundColor: bgColor, color: textColor }}
                      >
                        {display && (
                          <div className="flex items-center gap-1">
                            <span className="text-green-600">↖</span> {display} <span className="text-red-500">↘</span>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-white border border-[#E0E4E9] shadow-lg rounded py-1 z-50 text-[13px] w-48"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full text-left px-4 py-2 hover:bg-[#F5F6FA]"
            onClick={() => {
              setTimingModal({ empId: contextMenu.empId, date: contextMenu.date });
              setContextMenu(null);
            }}
          >
            Set Login/Logout time
          </button>
          <button className="w-full text-left px-4 py-2 hover:bg-[#F5F6FA]">Raise Adhoc</button>
          <div className="border-t border-[#E0E4E9] my-1"></div>
          <div className="px-4 py-1 text-[#595959] font-medium text-[11px]">Remove Roster</div>
          <button className="w-full text-left px-4 py-2 hover:bg-[#F5F6FA]" onClick={() => { removeRoster(contextMenu.empId, contextMenu.date, "login"); setContextMenu(null); }}>Remove Login</button>
          <button className="w-full text-left px-4 py-2 hover:bg-[#F5F6FA]" onClick={() => { removeRoster(contextMenu.empId, contextMenu.date, "logout"); setContextMenu(null); }}>Remove Logout</button>
          <button className="w-full text-left px-4 py-2 hover:bg-[#F5F6FA]" onClick={() => { removeRoster(contextMenu.empId, contextMenu.date, "both"); setContextMenu(null); }}>Remove Both</button>
        </div>
      )}

      {/* Timing Modal */}
      {timingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-[400px]">
            <div className="flex items-center justify-between p-4 border-b border-[#E0E4E9]">
              <h2 className="text-[16px] font-semibold text-[#222222]">Set Timing for {formatDateDisplay(timingModal.date)}</h2>
              <button onClick={() => setTimingModal(null)} className="text-[#595959] hover:text-[#222222]"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="roster-form-triptype" className="text-[12px] font-medium text-[#595959]">Trip Type</label>
                <select id="roster-form-triptype" value={formTripType} onChange={(e) => setFormTripType(e.target.value as any)} className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]">
                  <option value="both">Both (Login & Logout)</option>
                  <option value="pickup">Login (Pickup)</option>
                  <option value="drop">Logout (Drop)</option>
                </select>
              </div>
              {(formTripType === "pickup" || formTripType === "both") && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="roster-form-login" className="text-[12px] font-medium text-[#595959]">Login Time</label>
                  <input id="roster-form-login" type="time" value={formTiming} onChange={e => setFormTiming(e.target.value)} className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"/>
                </div>
              )}
              {(formTripType === "drop" || formTripType === "both") && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="roster-form-logout" className="text-[12px] font-medium text-[#595959]">Logout Time</label>
                  <input id="roster-form-logout" type="time" value={formDropTiming} onChange={e => setFormDropTiming(e.target.value)} className="border border-[#E0E4E9] rounded px-3 py-2 text-[13px]"/>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-[#E0E4E9] bg-[#F9F9F9] rounded-b-lg">
              <button onClick={() => setTimingModal(null)} className="px-4 py-2 text-[13px] text-[#222222] bg-white border border-[#E0E4E9] rounded hover:bg-[#F5F6FA]">Cancel</button>
              <button onClick={handleSaveModal} className="px-4 py-2 text-[13px] text-white bg-[#0047B2] rounded hover:bg-[#003a94]">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
