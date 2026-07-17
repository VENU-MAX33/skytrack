import { useState } from "react";
import {
  LayoutDashboard,
  Route,
  Users,
  Bus,
  MapPin,
  ChevronRight,
  Settings,
  UserCog,
  Car,
  User,
  FileText,
  KeyRound,
  MessageSquare,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth, type AdminRole } from "../context/AuthContext";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  children?: NavItem[];
  /** Omit for "everyone with a session"; set to restrict to specific roles. */
  roles?: AdminRole[];
}

const navigation: NavItem[] = [
  {
    icon: <LayoutDashboard className="w-[14px] h-[14px]" />,
    label: "Dashboard",
    href: "/",
  },
  {
    icon: <Route className="w-[14px] h-[14px]" />,
    label: "Planning",
    href: "#",
    children: [
      { icon: <Route className="w-[14px] h-[14px]" />, label: "Master Routing", href: "/master-routing" },
      { icon: <Route className="w-[14px] h-[14px]" />, label: "Route Management", href: "/route-management", roles: ["admin"] },
      { icon: <Users className="w-[14px] h-[14px]" />, label: "Rostering", href: "/rostering" },
      { icon: <Bus className="w-[14px] h-[14px]" />, label: "Trip Management", href: "/trip-management" },
    ],
  },
  {
    icon: <MapPin className="w-[14px] h-[14px]" />,
    label: "Monitoring",
    href: "#",
    children: [
      { icon: <MapPin className="w-[14px] h-[14px]" />, label: "Live Trips Status", href: "/live_trip_monitor" },
    ],
  },
  {
    icon: <UserCog className="w-[14px] h-[14px]" />,
    label: "Masters",
    href: "#",
    children: [
      { icon: <Users className="w-[14px] h-[14px]" />, label: "Employee management", href: "/employee-management" },
      { icon: <Settings className="w-[14px] h-[14px]" />, label: "Activate / Deactivate", href: "/activate-deactivate" },
      { icon: <Car className="w-[14px] h-[14px]" />, label: "Vehicle", href: "/vehicle-management" },
      { icon: <User className="w-[14px] h-[14px]" />, label: "Driver", href: "/driver-management" },
    ],
  },
  {
    icon: <FileText className="w-[14px] h-[14px]" />,
    label: "Reports",
    href: "/reports",
    roles: ["admin"],
  },
  {
    icon: <MessageSquare className="w-[14px] h-[14px]" />,
    label: "Feedback",
    href: "/feedback",
    roles: ["admin"],
  },
  {
    icon: <MapPin className="w-[14px] h-[14px]" />,
    label: "Tracking",
    href: "#",
    children: [
      { icon: <MapPin className="w-[14px] h-[14px]" />, label: "Vehicle tracking", href: "/vehicle-tracking" },
    ],
  },
  {
    icon: <KeyRound className="w-[14px] h-[14px]" />,
    label: "Staff Logins",
    href: "/staff-management",
    roles: ["admin"],
  },
];

function visibleFor(role: AdminRole) {
  return (item: NavItem) => !item.roles || item.roles.includes(role) || (role === 'platform-owner' && item.roles.includes('admin'));
}

// Each group with sub-options gets its own light color — the parent and its
// submenu share the same hue when open, so it's visually obvious which
// sub-options belong to which section instead of everything turning the
// same generic grey/blue.
const GROUP_THEME: Record<string, { text: string; bg: string; icon: string }> = {
  Planning: { text: "#0047B2", bg: "#E8F4FD", icon: "#0047B2" },
  Monitoring: { text: "#18751C", bg: "#E8F5E9", icon: "#18751C" },
  Masters: { text: "#6A5CA1", bg: "#F1EEFA", icon: "#6A5CA1" },
  Tracking: { text: "#E65100", bg: "#FFF3E0", icon: "#E65100" },
};
const DEFAULT_THEME = { text: "#0047B2", bg: "#E8F4FD", icon: "#0047B2" };

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(["Masters"]);
  const location = useLocation();
  const { user } = useAuth();
  const role: AdminRole = user?.role ?? "staff";

  const visibleNav = navigation
    .filter(visibleFor(role))
    .map((item) => (item.children ? { ...item, children: item.children.filter(visibleFor(role)) } : item))
    .filter((item) => !item.children || item.children.length > 0);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isRouteActive = (href: string) => {
    if (href === "#") return false;
    if (href === "/" && location.pathname !== "/") return false;
    return location.pathname.startsWith(href);
  };

  return (
    <aside className={`main-sidebar ${open ? "is-open" : ""}`} aria-label="Admin navigation">
      <ul className="sidebar-menu">
        <li className="header text-[#848484] text-[12px] px-4 py-3 uppercase tracking-wide">
          Navigation Menu
        </li>
        {visibleNav.map((item) => {
          const isActive = isRouteActive(item.href) || item.children?.some(child => isRouteActive(child.href));
          const isExpanded = expandedItems.includes(item.label);
          const theme = GROUP_THEME[item.label] ?? DEFAULT_THEME;
          return (
            <li key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center justify-between px-5 py-2 text-[14px] transition-colors ${
                      isActive || isExpanded ? "" : "hover:text-[#222222] hover:bg-[#ECF0F5]"
                    }`}
                    style={
                      isActive || isExpanded
                        ? { backgroundColor: theme.bg, color: theme.text, fontWeight: 600 }
                        : { color: "rgba(0,0,0,0.7)" }
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="menu-icon"
                        style={{ color: isActive || isExpanded ? theme.icon : "rgba(0,0,0,0.5)" }}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight
                      className={`w-[14px] h-[14px] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </button>
                  {isExpanded && (
                    <ul className="submenu" style={{ backgroundColor: theme.bg }}>
                      {item.children.map((child) => {
                        const childActive = isRouteActive(child.href);
                        return (
                          <li key={child.label}>
                            <Link
                              to={child.href}
                              onClick={onClose}
                              className="flex items-center gap-3 pl-8 pr-5 py-2 text-[13px] transition-colors hover:brightness-95"
                              style={
                                childActive
                                  ? { color: theme.text, fontWeight: 600 }
                                  : { color: "rgba(0,0,0,0.65)" }
                              }
                            >
                              <span className="menu-icon">{child.icon}</span>
                              <span>{child.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-5 py-2 text-[14px] transition-colors ${
                    isActive
                      ? "bg-[#0047B2] text-white"
                      : "text-[#222222] hover:text-[#222222] hover:bg-[#ECF0F5]"
                  }`}
                >
                  <span className={`menu-icon ${isActive ? "text-white" : "text-[rgba(0,0,0,0.5)]"}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
