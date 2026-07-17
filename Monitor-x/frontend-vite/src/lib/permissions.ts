import type { AdminRole } from '../context/AuthContext';

// Paths staff cannot reach at all. Route Management (and RouteForm reused
// under the Master Routing prefix — same create/edit-route capability) and
// Reports are blocked by design because they are admin-only.
const STAFF_BLOCKED_PREFIXES = [
  '/route-management',
  '/master-routing/new',
  '/master-routing/edit',
  '/reports',
];

// Paths only the main admin can reach (staff never sees these in the Sidebar either).
const ADMIN_ONLY_PREFIXES = ['/staff-management'];

/** Single source of truth for route access, shared by ProtectedRoute and Sidebar filtering. */
export function isPathAllowed(role: AdminRole, pathname: string): boolean {
  if (role === 'admin' || role === 'platform-owner') return true;
  return !STAFF_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p)) &&
    !ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}
