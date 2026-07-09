import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, ChevronDown, User, AlertTriangle, MapPin, Navigation, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCompanyConfig } from "../api";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../api/notifications";
import { useRealtime } from "../context/RealtimeContext";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MX";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function typeIcon(type: AppNotification["type"]) {
  switch (type) {
    case "sos": return <AlertTriangle className="w-4 h-4 text-[#D22630]" />;
    case "location-request": return <MapPin className="w-4 h-4 text-[#E65100]" />;
    case "employee-location": return <Navigation className="w-4 h-4 text-[#0047B2]" />;
    default: return <Info className="w-4 h-4 text-[#777]" />;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Header() {
  const navigate = useNavigate();
  const { on } = useRealtime();
  const [companyName, setCompanyName] = useState("MonitorX");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getNotifications()
      .then((feed) => { setItems(feed.items); setUnread(feed.unread); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getCompanyConfig().then((cfg) => { if (cfg.name) setCompanyName(cfg.name); }).catch(() => {});
    load();
  }, [load]);

  // Live: prepend incoming notifications and bump the unread badge
  useEffect(() => {
    const off = on("notification:new", (payload) => {
      const n = payload as AppNotification;
      setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 50)));
      setUnread((u) => u + 1);
    });
    return off;
  }, [on]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      try { await markAllNotificationsRead(); } catch { /* ignore */ }
    }
  }

  async function handleClick(n: AppNotification) {
    setOpen(false);
    if (!n.read) { try { await markNotificationRead(n.id); } catch { /* ignore */ } }
    if (n.link) navigate(n.link);
  }

  return (
    <header className="main-header bg-white flex items-stretch">
      {/* Logo Area */}
      <div className="w-[230px] h-[51px] flex items-center justify-start px-4 border-r border-[#E0E4E9] overflow-hidden">
        <a href="/" className="flex items-center">
          <img src="/monitorx-logo.png" alt="MonitorX" className="h-[40px] w-auto rounded-md" />
        </a>
      </div>

      {/* Navbar */}
      <nav className="flex-1 flex items-center justify-between px-4 bg-white h-[51px]">
        {/* Left side - Company */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0047B2] rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">{initials(companyName)}</span>
          </div>
          <span className="text-[#222222] text-[13px] font-medium">{companyName}</span>
        </div>

        {/* Right side - User actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/route-management")}
            className="flex items-center gap-2 text-[13px] text-[#222222] hover:bg-[#F5F6FA] px-3 py-1.5 rounded"
            title="Change company details"
          >
            <span>{companyName}</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <div className="relative" ref={panelRef}>
            <button onClick={handleOpen} className="relative p-2 hover:bg-[#F5F6FA] rounded" title="Notifications">
              <Bell className="w-4 h-4 text-[#222222]" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#D22630] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[340px] bg-white rounded-lg shadow-xl border border-[#E0E4E9] z-[1200] max-h-[440px] flex flex-col">
                <div className="px-4 py-3 border-b border-[#E0E4E9] flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#222]">Notifications</span>
                  <span className="text-[11px] text-[#777]">{items.length} recent</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  {items.length === 0 ? (
                    <div className="text-center text-[13px] text-[#aaa] py-8">No notifications yet</div>
                  ) : (
                    items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-[#f5f5f5] hover:bg-[#fafafa] ${
                          n.read ? "" : "bg-[#EEF4FF]"
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">{typeIcon(n.type)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-medium text-[#222] truncate">{n.title}</span>
                          {n.body && <span className="block text-[11px] text-[#777] truncate">{n.body}</span>}
                          <span className="block text-[10px] text-[#aaa] mt-0.5">{relativeTime(n.createdAt)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar */}
          <button className="flex items-center gap-2 p-1 hover:bg-[#F5F6FA] rounded">
            <div className="w-[26px] h-[26px] rounded-full bg-[#0047B2] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      </nav>
    </header>
  );
}
