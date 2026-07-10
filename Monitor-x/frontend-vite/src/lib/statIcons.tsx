import type { LucideIcon } from "lucide-react";
import {
  ClipboardList, Users, Clock, CheckCircle2, Flag,
  LogIn, LogOut, Bus, Activity, Play, Timer, AlertCircle, XCircle,
  CalendarClock, Ban, BarChart3, ClipboardCheck, AlertTriangle, Navigation,
} from "lucide-react";

export interface StatVisual {
  Icon: LucideIcon;
  /** Icon colour */
  color: string;
  /** Chip background */
  bg: string;
}

/**
 * One colour-coded icon per dashboard metric/panel, so the admin can identify
 * each box at a glance. Keys are the exact labels/titles rendered on the
 * dashboard; unknown labels get no icon (layout unchanged).
 */
const VISUALS: Record<string, StatVisual> = {
  // Card titles
  "Rostering":            { Icon: ClipboardList, color: "#0047B2", bg: "#E3EDFB" },
  "Employees Trips":      { Icon: Bus,           color: "#6a5ca1", bg: "#EFEBFA" },
  "Live Trips":           { Icon: Activity,      color: "#18751C", bg: "#E4F3E5" },
  "Approval":             { Icon: ClipboardCheck,color: "#0E7C86", bg: "#E0F3F5" },
  "SOS Alerts":           { Icon: AlertTriangle, color: "#D22630", bg: "#FBE5E6" },
  "Live Employee Locations": { Icon: Navigation, color: "#0047B2", bg: "#E3EDFB" },

  // Rostering stats
  "Total Rostered":       { Icon: Users,         color: "#0047B2", bg: "#E3EDFB" },
  "Pending":              { Icon: Clock,         color: "#B7791F", bg: "#FBF0DC" },
  "Approved":             { Icon: CheckCircle2,  color: "#18751C", bg: "#E4F3E5" },
  "Completed":            { Icon: Flag,          color: "#0E7C86", bg: "#E0F3F5" },

  // Employee trips stats
  "Login (Pick)":         { Icon: LogIn,         color: "#4338CA", bg: "#E7E6FA" },
  "Logout (Drop)":        { Icon: LogOut,        color: "#C2410C", bg: "#FBE9DE" },

  // Live trips stats (trip started / ended / delayed / cancelled…)
  "In Progress":          { Icon: Play,          color: "#0047B2", bg: "#E3EDFB" },
  "Yet To Start":         { Icon: Timer,         color: "#64748B", bg: "#EBEFF3" },
  "Delayed":              { Icon: AlertCircle,   color: "#B7791F", bg: "#FBF0DC" },
  "Cancelled":            { Icon: XCircle,       color: "#D22630", bg: "#FBE5E6" },

  // Bottom tables
  "Trips In Progress":    { Icon: Play,          color: "#0047B2", bg: "#E3EDFB" },
  "Upcoming Trips":       { Icon: CalendarClock, color: "#6a5ca1", bg: "#EFEBFA" },
  "Auto Cancel":          { Icon: Ban,           color: "#D22630", bg: "#FBE5E6" },
  "Vendor Performance":   { Icon: BarChart3,     color: "#7C3AED", bg: "#EFE7FC" },
};

export function statVisual(label: string): StatVisual | null {
  return VISUALS[label] ?? null;
}

/** Small rounded icon chip; renders nothing for unknown labels. */
export function StatIcon({ label, size = 14 }: { label: string; size?: number }) {
  const v = statVisual(label);
  if (!v) return null;
  const { Icon, color, bg } = v;
  const box = size + 10;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md shrink-0"
      style={{ backgroundColor: bg, width: box, height: box }}
    >
      <Icon size={size} style={{ color }} />
    </span>
  );
}
