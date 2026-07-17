import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, ChevronDown, User, AlertTriangle, MapPin, Navigation, Info, LogOut, UserCheck, Menu, X, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCompanyConfig } from "../api";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../api/notifications";
import { useRealtime } from "../context/RealtimeContext";
import { useAuth } from "../context/AuthContext";

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
    case "escort": return <UserCheck className="w-4 h-4 text-[#6a5ca1]" />;
    default: return <Info className="w-4 h-4 text-[#595959]" />;
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

interface HeaderProps {
  menuOpen?: boolean;
  onMenuToggle?: () => void;
}

export default function Header({ menuOpen = false, onMenuToggle }: HeaderProps) {
  const navigate = useNavigate();
  const { on } = useRealtime();
  const { user, logout, exitCompany } = useAuth();
  const [companyName, setCompanyName] = useState("SkyTrack");
  const [companyLogo, setCompanyLogo] = useState("");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profilePanelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getNotifications()
      .then((feed) => { setItems(feed.items); setUnread(feed.unread); })
      .catch(() => {});
  }, []);

  const loadCompany = useCallback(() => {
    getCompanyConfig()
      .then((cfg) => {
        setCompanyName(cfg.name || "SkyTrack");
        setCompanyLogo(cfg.logoBase64 || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCompany();
    load();
  }, [load, loadCompany]);

  // The header is mounted once by Layout and persists across navigation, so it
  // must re-fetch when the company name/logo is changed on the Route Management
  // screen (which dispatches this event after a successful save).
  useEffect(() => {
    window.addEventListener("company:updated", loadCompany);
    return () => window.removeEventListener("company:updated", loadCompany);
  }, [loadCompany]);

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

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function onDoc(e: MouseEvent) {
      if (profilePanelRef.current && !profilePanelRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen]);

  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate("/login");
  }

  async function handleCompanyManagement() {
    setProfileOpen(false);
    if (user?.role === 'platform-owner' && user.company) await exitCompany();
    navigate('/companies');
  }

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
      <div className="header-logo h-[51px] flex items-center justify-start px-4 border-r border-[#E0E4E9] overflow-hidden">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onMenuToggle}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <a href="/" className="flex items-center">
          <img
            src={companyLogo || "/skytrack-logo.png"}
            alt={companyName}
            className="h-[40px] w-auto rounded-md object-contain"
          />
        </a>
      </div>

      {/* Navbar */}
      <nav className="flex-1 flex items-center justify-between px-4 bg-white h-[51px]">
        {/* Left side - Company */}
        <div className="flex items-center gap-2">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={companyName}
              className="w-8 h-8 rounded object-contain bg-white border border-[#E0E4E9]"
            />
          ) : (
            <div className="w-8 h-8 bg-[#0047B2] rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">{initials(companyName)}</span>
            </div>
          )}
          <span className="header-company-name text-[#222222] text-[13px] font-medium">{companyName}</span>
        </div>

        {/* Right side - User actions */}
        <div className="header-actions flex items-center gap-4">
          <button
            onClick={() => navigate("/route-management")}
            className="company-switcher flex items-center gap-2 text-[13px] text-[#222222] hover:bg-[#F5F6FA] px-3 py-1.5 rounded"
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
              <div className="notification-panel absolute right-0 mt-2 w-[340px] bg-white rounded-lg shadow-xl border border-[#E0E4E9] z-[1200] max-h-[440px] flex flex-col">
                <div className="px-4 py-3 border-b border-[#E0E4E9] flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#222]">Notifications</span>
                  <span className="text-[11px] text-[#595959]">{items.length} recent</span>
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
                          {n.body && <span className="block text-[11px] text-[#595959] truncate">{n.body}</span>}
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
          <div className="relative" ref={profilePanelRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 p-1 hover:bg-[#F5F6FA] rounded"
              title={user?.name}
            >
              <div className="w-[26px] h-[26px] rounded-full bg-[#0047B2] flex items-center justify-center">
                {user ? (
                  <span className="text-white text-[10px] font-bold">{initials(user.name)}</span>
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
            </button>

            {profileOpen && user && (
              <div className="absolute right-0 mt-2 w-[240px] bg-white rounded-lg shadow-xl border border-[#E0E4E9] z-[1200]">
                <div className="px-4 py-3 border-b border-[#E0E4E9] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0047B2] flex items-center justify-center shrink-0">
                    <span className="text-white text-[12px] font-bold">{initials(user.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#222] truncate">{user.name}</div>
                    <div className="text-[11px] text-[#595959] truncate">{user.email}</div>
                  </div>
                </div>
                <div className="px-4 py-2 border-b border-[#E0E4E9]">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      user.role !== "staff" ? "bg-[#E8F4FD] text-[#0047B2]" : "bg-[#F5F6FA] text-[#555]"
                    }`}
                  >
                    {user.role === "platform-owner" ? "PLATFORM OWNER" : user.role === "admin" ? "ADMIN" : "STAFF"}
                  </span>
                  {user.company && <div className="text-[11px] text-[#595959] mt-2">Working in: <strong>{user.company.name}</strong></div>}
                </div>
                {user.role === 'platform-owner' && <button onClick={handleCompanyManagement} className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-[#0047B2] hover:bg-[#EEF4FF] border-b border-[#E0E4E9]"><Building2 className="w-4 h-4" /> Manage / switch companies</button>}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-[#D22630] hover:bg-[#FFF5F5] rounded-b-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
