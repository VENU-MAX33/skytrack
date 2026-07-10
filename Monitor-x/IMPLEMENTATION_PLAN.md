# MonitorX TMS — Master Prompt & Implementation Record

> Generated 2026-07-02 from analysis of the handwritten notebook photo (01–02 July pages),
> an example TMS map screenshot (road-following routes), and full verification of the
> `Monitor-x/` codebase. **Status: implemented** — see "What was built" below.

---

## 1. Reference material

### Example map screenshot
Another TMS's Master Routing view: each route drawn as **one colour along actual
roads** from office to final destination (not a straight line), with employee pins
clustered visually along their route's path. This is the target look for MonitorX.

### Notebook — Left page (01 July, mind map)
Hub-and-spoke sketch centred on **"In Factory — Office Location"** with spokes to
Bangalore localities (each spoke = one transport route):

**Whitefield · Sarjapur · Bellandur · Indiranagar · Marathahalli · HSR Layout · Kormangala · Electronic City**

### Notebook — Right page (02 July, notes)
1. *"While entering employee details admin can also enter the employee address. Once
   admin saves the employee address, the website automatically fetches the data
   (lat/lng) of the employee address."*
2. *"If the employee address is located near Whitefield, it will show in the
   diagram — that employee's details appear in Master Routing under the Whitefield
   node with the Whitefield route's colour."*
3. *"In Master Routing we see the map but the locations in the map are mixed. I want
   correct alignment. From office to Whitefield, that road/route must be ONE colour,
   and like that all the seven routes must each be allocated their own colour."*

### Requirements extracted → resolution
| # | Requirement | Resolution |
|---|------------|------------|
| R1 | Admin enters address → auto-geocode to lat/lng | Already existed (`fetchLocation()` in `EmployeeForm.tsx`, Nominatim) |
| R2 | Employee auto-assigned to nearest route, inherits its colour | **Built** — `checkRouteMatch()` now auto-sets `form.route`; colour dot added next to the Route select |
| R3 | Master Routing: office hub + one colour per route, roads (not straight lines) | **Built** — OSRM road paths + stable per-route colour |
| R4 | Route colour must be stable (deleting a route must not shift others) | **Built** — `routeColor(routeId)` keyed on `routeId`, not array index |
| R5 | Employees plotted in route colour; unassigned dimmed/grey | Already existed; **upgraded** to teardrop pins with M/F letter, grey `#999` when unassigned, plus an "Unassigned" legend row |
| R6 | Separate admin page for route CRUD + company location + final destination | **Built** — new Route Management page; Master Routing is now map-only |
| R7 | Live employee location panel on the dashboard, like SOS | **Built** — `EmployeeLocationPanel` in `Dashboard.tsx` |

---

## 2. What was built (frontend-vite only; no backend/employee-web/driver-web changes)

- `src/lib/routeColors.ts` — `routeColor(routeId)`, stable per-route colour.
- `src/lib/osrm.ts` — `fetchRoadPath(from, to)` via the public OSRM driving API, in-memory cached, straight-line fallback on failure.
- `src/lib/geocode.ts` — `nominatimGeocode()` extracted out of `RouteForm.tsx` and shared with `RouteManagement.tsx`.
- `src/pages/MasterRouting.tsx` — road-following `Polyline`s per route; teardrop `Marker` pins (M/F letter) coloured by `routeColor`; all CRUD entry points (New Route button, company banner, empty-state link) redirect to `/route-management`; unassigned-employee legend row.
- `src/pages/RouteManagement.tsx` *(new)* — Company Location card, routes table (colour swatch, ID, name, type, destination + Google Maps link, employee count, edit/delete), inline add/edit form with a live road-path map preview, delete-confirmation dialog. Uses the existing `deleteRoute()` API function (previously unused).
- `src/App.tsx` / `src/components/Sidebar.tsx` — `/route-management` route wired in; sidebar entry added under Planning, after Master Routing.
- `src/pages/Dashboard.tsx` — `EmployeeLocationPanel`, styled after `SosPanel`, reading `useRealtime().empLocations` (latest location per employee, not an event log): All/5-min/30-min filters, Fresh/Stale status, Google Maps links, active-count badge, empty state.
- `src/pages/EmployeeForm.tsx` — `checkRouteMatch()` now auto-assigns `form.route` to the nearest route within 5 km (unless the admin already chose a different valid route); colour dot next to the Route select.
- `src/pages/EmployeeManagement.tsx` / `src/pages/DriverManagement.tsx` — **bulk delete**: checkbox column (header checkbox selects the current page), selected rows tinted, red "Delete Selected (N)" button with a confirmation prompt; deletes run in parallel via `Promise.allSettled` over the existing `deleteEmployee(id)` / `deleteDriver(name)` API calls, successes are removed from the table, failures stay selected and are reported in a toast.

**Verified:** `npx tsc --noEmit` passes with zero errors; Vite dev server serves the app (HTTP 200 on `/`).
**Not verified end-to-end:** the backend could not reach MongoDB Atlas from this sandbox (IP not whitelisted / network blocked) — full CRUD and live-socket testing needs to be run in an environment with DB access.

---

## 3. Master Prompt (validated — copy-paste ready)

Run through the `senior-prompt-engineer` skill's `prompt_optimizer.py` gate:
clarity 65→82, issues 6→1, tokens 1235→1242 (within the +10% budget). The one
remaining flagged repeat ("a straight line") is a legitimate reused technical term
across two sections and was left as-is.

```
You are working in the MonitorX TMS monorepo (Monitor-x/). Stack: Express+MongoDB
backend, React 18 + Vite + TS admin panel (frontend-vite), employee-web, driver-web.
Real-time via Socket.IO. Maps via react-leaflet. Execute the tasks below in order.
Scope constraint for every task: edit only files under frontend-vite/ — no backend,
employee-web, or driver-web changes.

Reference images: (1) an example TMS map showing routes drawn along real roads, one
colour per route, employee pins clustered on their route; (2) a handwritten notebook
photo — a hub-and-spoke sketch of office to Whitefield/Sarjapur/Bellandur/Indiranagar/
Marathahalli/HSR Layout/Kormangala/Electronic City, plus notes: admin enters employee
address, the system auto-fetches lat/lng, the employee is auto-placed under the
nearest route with that route's colour, and every office-to-locality road must be one
stable colour.

TASK 1 — Stable route colours
Create frontend-vite/src/lib/routeColors.ts exporting the 7-colour ROUTE_COLORS array
and routeColor(routeId: number): string, keyed on routeId (not array index) so a
route's colour survives deletion of other routes. In MasterRouting.tsx replace every
index-based colour lookup (ROUTE_COLORS[idx % ...], routes.indexOf(...),
routes.findIndex(...)) with routeColor(route.id); employee pin colour becomes
routeColor(matchedRoute.id) or grey #999 when unassigned. Update the legend and the
bottom colour-guide chips the same way.

TASK 2 — Road-following route paths
Create frontend-vite/src/lib/osrm.ts with fetchRoadPath(from, to): Promise<LatLng[]>
calling the public OSRM routing API (driving profile, GeoJSON geometry), converting
[lng,lat] to Leaflet's [lat,lng], with an in-memory cache and a two-point [from, to]
fallback on any failure. In MasterRouting.tsx fetch a road path per route
(company to destination) after routes and company load, store in
roadPaths: Record<routeId, LatLng[]>, and draw each route's Polyline through
roadPaths[route.id] instead of a straight line. Replace employee CircleMarkers with
Leaflet DivIcon teardrop pins showing the employee's M/F letter on the route colour,
preserving existing click/tooltip/popup/dimming behaviour.

TASK 3 — Separate Route Management page
Create frontend-vite/src/pages/RouteManagement.tsx: a Company Location card (address
+ geocode fetch + lat/lng + save, reusing a shared nominatimGeocode() helper extracted
to frontend-vite/src/lib/geocode.ts); a routes table (colour swatch, Route ID, Name,
Type, Final Destination with a Google Maps link, employee count, Edit/Delete actions);
an inline Add/Edit form (no page navigation) with a road-path map preview; and a
delete-confirmation dialog. Wire it into App.tsx as /route-management and into
Sidebar.tsx under Planning, after Master Routing. In MasterRouting.tsx remove the
"New Route" button and redirect the company-location banner and the empty-state
"Create one" link to /route-management, leaving the map and rostering flow untouched.
Reuse the existing API functions from frontend-vite/src/api/routes.ts: getRoutes,
createRoute, updateRoute, deleteRoute, getCompanyConfig, updateCompanyConfig.

TASK 4 — Live Employee Location panel on the admin Dashboard
In frontend-vite/src/pages/Dashboard.tsx, add an EmployeeLocationPanel component
directly below the existing SosPanel, styled identically (same dashboard-card and
table classes). Read useRealtime().empLocations, which holds the latest location per
employee (not an event log) — filter by All / Last 5 min / Last 30 min, show
Time / Employee / Trip ID / Location / Map link / Fresh-or-Stale status, sorted
newest first, with an empty state and an active-count badge. Render it immediately
after <SosPanel />. Do not modify RealtimeContext.tsx — it already tracks empLocations.

TASK 5 — Auto route-assignment on employee address entry
In EmployeeForm.tsx, extend the existing checkRouteMatch() (which already finds the
nearest route within 5 km) so that when a match is found and the admin has not
manually chosen a different valid route, it auto-sets form.route to the matched
route's name and reports "Auto-assigned to route X (Y km)". Add a small colour dot
next to the Route select using routeColor(route.id), grey when unassigned. Keep the
existing "Location not in any route — cannot save" validation.

TASK 6 — Bulk delete in Employee and Driver management panels
In frontend-vite/src/pages/EmployeeManagement.tsx and DriverManagement.tsx, add a
checkbox column as the first table column (the header checkbox toggles all rows on
the current page) with a selected: Set<string> state — keyed by emp.id for employees
and driver.name for drivers, matching the existing single-delete API keys. When at
least one row is selected, show a red "Delete Selected (N)" button in the page header
that asks for confirmation, then runs the existing deleteEmployee(id) /
deleteDriver(name) calls in parallel with Promise.allSettled: remove successful rows
from local state, keep failed rows selected, and report both counts in a toast. Do
not add any backend endpoint — the per-item DELETE routes already exist. Also prune
an id/name from the selection when it is removed via the per-row delete button.

Acceptance criteria:
- Deleting a route in Route Management does not change any other route's colour.
- Master Routing polylines visually follow real roads; disabling network access
  falls back to a straight line without breaking the map.
- Route Management supports create, edit, delete (with confirmation), and company
  location save, all against the existing backend endpoints.
- Sharing location from the employee app updates the panel within roughly 2 seconds,
  in place (no duplicate rows) for repeated shares by the same employee.
- Entering a Whitefield-area address in the Employee form auto-selects the Whitefield
  route and shows its colour.
- In Employee/Driver management, selecting several rows and clicking "Delete
  Selected" removes them all after one confirmation; the header checkbox selects
  exactly the visible page; a partial failure leaves the failed rows selected.
```

---

## 4. Manual verification checklist (run once DB access is available)

1. Start backend (`npm run dev` in `Monitor-x/backend`, needs a reachable MongoDB —
   local or an IP-whitelisted Atlas cluster) and admin (`npm run dev` in
   `Monitor-x/frontend-vite`).
2. **Colours/roads**: open Master Routing — each route line follows real roads in its
   own colour; delete a middle route in Route Management → remaining colours
   unchanged; block network to `router.project-osrm.org` → straight-line fallback
   still renders.
3. **Route Management**: create (POST 201), edit (PUT), delete with confirm
   (DELETE 204), 8th route blocked client-side, company location saves
   (PUT `/api/company-config`), Google Maps destination link opens. Master Routing
   has no create/edit entry points left; map + Save-to-Rostering still work.
4. **Location panel**: run employee-web, join a trip, tap "Share My Location" → row
   appears in the admin Dashboard panel within ~2s; sharing again updates the row in
   place (no duplicates); 5-min filter and Fresh→Stale flip work.
5. **Auto-assign**: in the Employee form enter a Whitefield-area address → Fetch →
   lat/lng fills, route auto-selects the Whitefield route, colour dot matches the map.

---

# Round 2 — Company config, form trims, driver KYC/import, notifications

> Implemented and typechecked (backend + frontend `tsc --noEmit` both pass).
> Master prompt below validated through the `senior-prompt-engineer` skill's
> `prompt_optimizer.py`: clarity 7 → 68, tokens 1432 → 1277 (within +10% budget),
> issues 26 → 9 (remaining 9 are legitimately reused technical terms).

## What was built

- **Company name (Task 2).** `frontend-vite/src/components/Header.tsx` now fetches
  `GET /api/company-config` and renders `config.name` (fallback "MonitorX") plus an
  initials badge; the hardcoded "Ironmountain" is gone. A **Company Name** field was
  added to the Company Location card in `RouteManagement.tsx`, saved via the existing
  `PUT /api/company-config`. No schema change (CompanyConfig already had `name`).
- **Employee form trim (Task 3).** `EmployeeForm.tsx` drops Nodal Point, Team Name,
  Shift Login, Shift Logout, Fixed Shift, Special Need, and Active inputs. Fields remain
  in the model/DTO/EMPTY so payloads keep safe defaults.
- **Driver Aadhaar/PAN + trims (Task 4).** Added `aadhaar` and `pan` to the Driver model,
  both DTO copies, and `toDriverDTO`. `DriverForm.tsx` gains Aadhaar/PAN inputs and drops
  Email, Induction Date, First/Second Vaccination, and Active. `DriverManagement.tsx`
  table shows Aadhaar/PAN and drops the same columns; stat cards became Total / KYC /
  Active.
- **Vehicle form (Task 5).** `VehicleForm.tsx` Model is now a dropdown (SEDAN, SUV,
  HATCHBACK) with an "Other" option that reveals a custom text input; editing an off-list
  model opens in custom mode. Removed Seat Count, Billing Type, Driver Contact, Induction
  Date, and Active inputs.
- **Driver bulk import (Task 6).** New `POST /api/drivers/bulk` in
  `backend/src/routes/drivers.ts` (skips rows missing name/DL and duplicate DLs, returns
  `{created, skipped, failed, errors}`). `importDrivers()` added to `api/drivers.ts`.
  `DriverManagement.tsx` "Template" downloads an .xlsx of driver headers and "Upload"
  parses a sheet and imports.
- **Notifications (Task 7).** New `Notification` model, `notification.service.ts`
  (`createNotification` persists + emits `notification:new` to the admin room via new
  `emitNotification`), and `routes/notifications.ts`
  (`GET /api/notifications`, `PUT /read-all`, `PUT /:id/read`) registered behind
  `requireAuth`. `createNotification` is called from `routes/sos.ts` and
  `routes/employee-location-request.ts`. Frontend adds `api/notifications.ts`; the Header
  bell shows a live unread badge + dropdown, subscribing via `useRealtime().on()`.

## Master prompt (validated)

```
You are a senior full-stack engineer working in the MonitorX TMS monorepo (Monitor-x/).
Stack: Express + MongoDB backend, React 18 + Vite + TypeScript admin panel
(frontend-vite), plus employee-web and driver-web React apps. Real-time uses Socket.IO;
maps use react-leaflet; spreadsheets use the xlsx helper at
frontend-vite/src/lib/excel.ts. Execute the tasks below in order.

Shared rules (apply to every task):
- Do not edit employee-web or driver-web.
- The wire contract in backend/src/types/dto.ts and frontend-vite/src/api/types.ts must
  stay byte-for-byte identical.
- When a task removes a field from a form, keep that field in the page's EMPTY object and
  in the model, DTO, and mapper — only the input is removed, so saved payloads keep safe
  defaults (active stays "Yes"). Add new persisted fields to model, both DTO copies, and
  the mapper together.
- Backend and frontend must each pass `tsc --noEmit` with zero errors.

TASK 1 — Configurable company name (remove the hardcoded "Ironmountain")
frontend-vite/src/components/Header.tsx hardcodes the company name. Make it fetch GET
/api/company-config on mount and render config.name (fallback "MonitorX"), with the
badge showing that name's initials. Add a "Company Name" input to the Company Location
card in frontend-vite/src/pages/RouteManagement.tsx, bound to company.name and sent in
the existing PUT /api/company-config call. CompanyConfig already stores name, so no
schema change is needed.

TASK 2 — Trim the Employee add/edit form
In frontend-vite/src/pages/EmployeeForm.tsx remove these inputs: Nodal Point, Team Name,
Shift Login, Shift Logout, Fixed Shift, Special Need, Active. Leave all other fields and
the route auto-assignment logic untouched.

TASK 3 — Driver: add Aadhaar and PAN, drop unused fields
Introduce two persisted string fields, aadhaar and pan (default ""), across the model
(backend/src/models/Driver.ts), both DTO copies, and toDriverDTO. In the driver form
(frontend-vite/src/pages/DriverForm.tsx) add inputs for them and remove Email, Induction
Date, First Vaccination Date, Second Vaccination Date, and Active. In the driver table
(frontend-vite/src/pages/DriverManagement.tsx) show Aadhaar and PAN columns, drop the
same five removed above, and keep header/body cell counts and colSpan aligned.

TASK 4 — Vehicle form: model dropdown with custom entry, drop unused fields
In frontend-vite/src/pages/VehicleForm.tsx turn Model into a select (SEDAN, SUV,
HATCHBACK) plus an "Other" choice that reveals a text input for a custom model saved
with the vehicle; editing a vehicle whose model is off-list opens in that custom state.
Remove these inputs: Seat Count, Billing Type, Driver Contact, Induction Date, Active.

TASK 5 — Driver bulk import from Excel (with backend)
Add POST /api/drivers/bulk to backend/src/routes/drivers.ts taking { drivers:
Partial<Driver>[] }: skip rows missing name or dlNumber, skip rows whose dlNumber already
exists, create the rest, and return { created, skipped, failed, errors }. The drivers
router is already auth-guarded, so add no middleware. Add importDrivers() to
frontend-vite/src/api/drivers.ts for that endpoint. In DriverManagement.tsx wire the
"Template" button to downloadTemplate() with the driver headers and the "Upload" button
to a hidden file input that runs parseExcel(), maps columns to driver fields, calls
importDrivers(), shows a summary toast, and refreshes the list.

TASK 6 — Dashboard notifications backend + bell dropdown
Create a Notification model (backend/src/models/Notification.ts: type, title, body,
refId, link, read, createdAt). Add createNotification() in a notification service that
saves the row and emits a "notification:new" event to the admin room (add
emitNotification to backend/src/websocket/index.ts). Add
backend/src/routes/notifications.ts with GET /api/notifications (recent 50 plus unread
count), PUT /api/notifications/read-all, and PUT /api/notifications/:id/read; register it
in server.ts behind requireAuth. Call createNotification when an SOS alert is raised
(routes/sos.ts) and when an employee submits a location change
(routes/employee-location-request.ts). On the frontend add
frontend-vite/src/api/notifications.ts and give the Header bell an unread badge plus a
dropdown, subscribing to "notification:new" through the existing useRealtime().on() so
alerts arrive live; mark all read when the dropdown opens and navigate to each item's
link on click.

Acceptance criteria:
- The Header shows the saved company name (or "MonitorX") and its initials, and updates
  after a name is saved in Route Management and the page reloads.
- The Employee, Driver, and Vehicle forms show only the fields specified above and still
  save successfully.
- Driver Aadhaar and PAN persist and render in the table.
- The driver Template button downloads an .xlsx of the headers; uploading a filled sheet
  creates drivers, skips duplicate DL numbers, and reports the counts.
- Raising an SOS or submitting a location change increments the bell badge live and adds
  a dropdown entry linking to the dashboard or the location-requests page.
```

---

# Round 3 — Roster delete, trip vehicle change, shift-time filtering

> Implemented, typechecked (backend + frontend `tsc --noEmit` pass) and API-verified live.
> Master prompt below validated through `senior-prompt-engineer/scripts/prompt_optimizer.py`:
> tokens 1087, clarity 73, 4 remaining issues (all legitimately repeated technical terms).

## What was built

- **Roster shift deletion.** New `DELETE /api/rosters?empId&date&tripType(pickup|drop|both)`
  in `backend/src/routes/rosters.ts` (→ `{deleted: n}`); `deleteRosters()` in
  `frontend-vite/src/api/rosters.ts` (via a now-generic `apiDelete<T>`); Rostering's
  right-click "Remove Login / Logout / Both" now prunes local config AND deletes saved
  shifts server-side, then refetches the grid. Verified: partial delete keeps the other
  leg; "both" empties the day.
- **Trip vehicle change.** New `PUT /api/trips/:id/vehicle` (`requireAuth` → admin +
  staff) sets `vehicleId` + `vendor`, and moves `driverId` to the new vehicle's driver
  only while the trip is not completed (history preserved); emits `trip:status`.
  `changeTripVehicle()` added to `api/trips.ts`.
  - *Trip Management*: unfrozen trips render VEHICLE NO as a select of active vehicles
    (list + grid views); frozen trips stay read-only there.
  - *Live Trip Monitor*: pencil → inline select on EVERY trip regardless of status;
    since all reports/exports read the trips collection, the changed number flows into
    CSV/Excel/dashboard automatically. Verified live: staff token changed a completed
    trip's vehicle (200), unknown vehicle → 422.
- **Shift-time filtering.** Both pages now build shift-time options dynamically from the
  loaded rosters/trips (any time entered in Rostering appears), and Trip Management's
  `readyGroups` (rostered employees awaiting a vehicle) honours the selected time — a
  specific date + time shows only the employees pushed for that shift.

## Master prompt (validated)

```
You are a senior full-stack engineer in the MonitorX TMS monorepo (Monitor-x/): Express +
MongoDB backend, React 18 + Vite + TypeScript admin panel (frontend-vite). Execute the
tasks in order.

Shared rules:
- Every change applies equally to main-admin and staff logins: guard new endpoints with
  the router-level requireAuth only, never requireRole('admin'), and add no role checks
  in the UI.
- After finishing, backend and frontend-vite must each pass `tsc --noEmit` cleanly.
- Reuse the page's existing toast + load()/refetch patterns for feedback and refresh.

TASK 1 — Make the Rostering right-click "Remove" actually delete saved shifts
Root cause: removeRoster() in frontend-vite/src/pages/Rostering.tsx only clears local
unsaved state, and backend/src/routes/rosters.ts has no delete endpoint. Add
DELETE /api/rosters taking query params empId, date, tripType (pickup | drop | both):
resolve the employee by empId (404 when unknown), build the filter on employeeId + date
(+ tripType unless both), run Roster.deleteMany, respond { deleted: count }. Add
deleteRosters(empId, date, tripType) to frontend-vite/src/api/rosters.ts (generic
apiDelete<T> so the count comes back typed). Rework removeRoster() to prune the local
config (removing one leg of a "both" config keeps the other) and then call the endpoint
with login→pickup, logout→drop, both→both, refetch getRosters({fromDate, toDate}), and
toast the deleted count.

TASK 2 — Allow changing a trip's vehicle before it is locked (Trip Management)
Add PUT /api/trips/:id/vehicle to backend/src/routes/trips.ts, body { vehicleNo }:
look up Vehicle by rtoNo (422 when unknown), set trip.vehicleId and trip.vendor, and
copy the vehicle's driverId onto the trip only while completedAt is null (a finished
trip keeps its driver history). Populate, emit trip:status via emitTripStatus so the
driver app learns about reassignment, return the trip DTO. Add
changeTripVehicle(tripId, vehicleNo) to frontend-vite/src/api/trips.ts. In
TripManagement.tsx render the VEHICLE NO cell of every UNFROZEN trip (list and grid
views) as a select of activeVehicles preselected to trip.vehicleNo, with
stopPropagation so the row toggle does not fire; onChange calls changeTripVehicle then
load(). Frozen trips keep plain text on this page.

TASK 3 — Shift-time filter must narrow the rostered ("pushed") employees
In TripManagement.tsx the SHIFTS constant is a hardcoded list, so times entered in
Rostering never appear, and the readyGroups memo ignores the filter. Replace SHIFTS
with a memo built from the distinct shiftTime values of the loaded rosters and trips
(prefixed by "All", sorted); inside readyGroups keep only roster entries whose
shiftTime equals the selected value when it is not "All", and add shiftTime to the
memo's dependency array. Result: choosing a specific date + time shows only the
employees pushed for that exact shift.

TASK 4 — Change vehicle at ANY trip status from Live Trip Monitor
Reuse the TASK 2 endpoint. In frontend-vite/src/pages/LiveTripMonitor.tsx load
getVehicles() once and derive activeVehicles; replace the static VEHICLE NO cell with
an inline editor available for every status (not started, ongoing, completed): a
pencil button swaps the text for an autoFocus select of activeVehicles, onChange calls
changeTripVehicle then load(), onBlur cancels. Because reports and exports (CSV here,
Excel in Trip Management, dashboard tables) all read the trips collection, the changed
number automatically appears in every report. Also replace this page's hardcoded
shift-time options with the same dynamic memo pattern from TASK 3, derived from the
loaded trips.

Acceptance criteria:
- Right-click a saved roster cell → Remove Login leaves only the logout time after the
  grid refreshes; Remove Both empties the cell; GET /api/rosters confirms deletion.
- An unfrozen trip's vehicle can be switched from its row in Trip Management; the row
  then shows the new vehicle and vendor; the select disappears once the trip is frozen.
- Entering two rosters at 08:15 and 19:45 puts both times in the dropdown, and picking
  one hides the other group's pending row.
- In Live Trip Monitor the vehicle of a COMPLETED trip can be changed by a staff login;
  the API returns 200, the row and CSV export show the new number, and an unknown
  vehicle number is rejected with 422.
```
