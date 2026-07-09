/** Fixed palette — one colour per route, matching MAX_ROUTES = 7 on the backend. */
export const ROUTE_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316",
];

/**
 * Stable colour for a route, keyed on its routeId so the colour never shifts
 * when other routes are created or deleted.
 */
export function routeColor(routeId: number): string {
  const n = ROUTE_COLORS.length;
  return ROUTE_COLORS[((routeId - 1) % n + n) % n];
}
