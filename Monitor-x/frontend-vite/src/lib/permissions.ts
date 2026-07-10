import type { AdminRole } from '../context/AuthContext';

// Paths staff cannot reach at all. Route Management (and RouteForm reused
// under the Master Routing prefix — same create/edit-route capability) and
// Reports are blocked by design; Location Requests is blocked because its
// backend (location-requests.ts) already gates every verb to admin only —
// staff would otherwise land on a page that 403s on load.
const STAFF_BLOCKED_PREFIXES = [
  '/route-management',
  '/master-routing/new',
  '/master-routing/edit',
  '/reports',
  '/location-requests',
];

// Paths only the main admin can reach (staff never sees these in the Sidebar either).
const ADMIN_ONLY_PREFIXES = ['/staff-management'];

/** Single source of truth for route access, shared by ProtectedRoute and Sidebar filtering. */
export function isPathAllowed(role: AdminRole, pathname: string): boolean {
  if (role === 'admin') return true;
  return !STAFF_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}
