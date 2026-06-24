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
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  children?: NavItem[];
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
    icon: <MapPin className="w-[14px] h-[14px]" />,
    label: "Tracking",
    href: "#",
    children: [
      { icon: <MapPin className="w-[14px] h-[14px]" />, label: "Vehicle tracking", href: "/vehicle-tracking" },
    ],
  },
];

export default function Sidebar() {
  const [expandedItems, setExpandedItems] = useState<string[]>(["Masters"]);
  const location = useLocation();

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
    <aside className="main-sidebar">
      <ul className="sidebar-menu">
        <li className="header text-[#848484] text-[12px] px-4 py-3 uppercase tracking-wide">
          Navigation Menu
        </li>
        {navigation.map((item) => {
          const isActive = isRouteActive(item.href) || item.children?.some(child => isRouteActive(child.href));
          return (
            <li key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center justify-between px-5 py-2 text-[14px] text-[rgba(0,0,0,0.7)] hover:text-[#222222] hover:bg-[#ECF0F5] transition-colors ${
                      isActive ? "bg-[#0047B2] text-white" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="menu-icon text-[rgba(0,0,0,0.5)]">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight
                      className={`w-[14px] h-[14px] transition-transform ${
                        expandedItems.includes(item.label) ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {expandedItems.includes(item.label) && (
                    <ul className="submenu bg-[#F9F9F9]">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <Link
                            to={child.href}
                            className={`flex items-center gap-3 pl-8 pr-5 py-2 text-[13px] hover:text-[#1B1B1B] hover:bg-[#ECF0F5] transition-colors ${
                              isRouteActive(child.href) ? "text-[#0047B2] font-semibold" : "text-[rgba(0,0,0,0.7)]"
                            }`}
                          >
                            <span className="menu-icon">{child.icon}</span>
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <Link
                  to={item.href}
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
