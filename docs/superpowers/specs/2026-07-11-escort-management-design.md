# Escort Management — Design Spec

**Date:** 2026-07-11
**Status:** Draft for review

## Problem

Today a trip's `escort` field is a single string (`"Yes"`/`"No"`) that is:
- Read-only in the admin Trip Management table.
- Not editable anywhere, has no associated escort name.
- Not shown at all in the employee or driver apps.

We want escort to be a real, editable, end-to-end concept:

1. **Admin** can set a trip's escort to Yes/No **and** enter an optional escort name in Trip Management, the same way the vehicle-number cell is editable.
2. That escort status + name is **displayed** in the employee app and the driver app.
3. The **employee** can report the escort situation from their app via a SOS-style button ("Is an escort present?" Yes/No + optional name).
4. An employee report appears in the **admin panel as a live feed, mirroring the SOS panel**, AND updates the trip's escort status/name (so the driver app reflects it).

## Decisions (confirmed with user)

- Employee report **both** shows in an admin feed **and** updates the trip's escort field.
- Admin side uses the **full SOS mirror** approach: a dedicated `EscortReport` model + routes + WebSocket event + a dedicated "Escort Reports" panel on the admin Dashboard.
- **No photo** on escort reports (unlike SOS). Just presence + optional name.

## Data Model

### Trip (modify)
Add one field to `backend/src/models/Trip.ts`:
- `escortName: string` — `{ type: String, default: '' }`. Optional escort person's name.

Existing `escort: string` (`"Yes"`/`"No"`, default `"No"`) is kept as-is.

Both fields must be threaded through the trip DTO and mappers (`backend/src/mappers.ts`, `backend/src/types/dto.ts`) so admin/employee/driver DTOs carry `escort` and `escortName`. `escort` is already mapped; add `escortName` alongside it in each mapper that emits a trip.

### EscortReport (new)
New model `backend/src/models/EscortReport.ts`, mirroring `SOSAlert`:

```
employeeId: ObjectId (ref Employee, required)
tripId:     ObjectId (ref Trip, default null)
driverId:   ObjectId (ref Driver, default null)
present:    string  ("Yes" | "No")   // did the employee see an escort
escortName: string  (default '')
employeeName:    string (default '')  // denormalized for display
employeeContact: string (default '')  // denormalized for display
status:     'open' | 'acknowledged'  (default 'open')
acknowledgedBy?: string
acknowledgedAt?: Date
timestamps: true
```
Index: `{ status: 1, createdAt: -1 }` (same as SOS).

## Backend

### Routes

**Admin edits escort on a trip** — new route in `backend/src/routes/trips.ts`:
- `PUT /api/trips/:tripId/escort`, `requireRole('admin')`, body `{ escort: 'Yes'|'No', escortName?: string }`.
- Updates the trip, returns the trip DTO.
- Emits a trip-refresh event so the driver + employee apps update live (see WebSocket).

**Employee reports escort** — new router `backend/src/routes/escort-report.ts` (registered in `backend/src/app.ts`), mirroring `sos.ts`:
- `POST /api/escort-report`, `requireRole('employee')`, `idempotent()`, body `{ tripId, present: 'Yes'|'No', escortName? }`.
  - Look up trip → `tripObjectId`, `driverObjectId`.
  - Look up employee → name/contact for denormalization.
  - Create `EscortReport` via a new `services/escort-report.service.ts` `createEscortReport(...)`.
  - **Update the trip**: `trip.escort = present; trip.escortName = escortName ?? ''`.
  - Emit `escort:report` to admins (+ assigned driver) via `emitEscortReport`.
  - Emit the trip-refresh event so driver/employee apps reflect the new escort value.
  - Create an admin notification (type `escort`) via `createNotification`, mirroring SOS.
  - Return the escort-report DTO.
- `GET /api/escort-report`, `requireRole('admin')` — list reports (open first / by status), like `GET /api/sos`.
- `PUT /api/escort-report/:id/acknowledge`, `requireRole('admin')` — mark acknowledged, emit `escort:report:acknowledged`.
- `DELETE /api/escort-report/:id`, `requireRole('admin')` — delete a report (main admin), like SOS delete.

### Mappers / DTO
- Add `toEscortReportDTO` in `backend/src/mappers.ts` mirroring `toSosDTO` (id, employee {name, contact}, trip id, present, escortName, status, timestamps).
- Add the escort-report DTO type + `escortName` on trip DTOs in `backend/src/types/dto.ts`.

### WebSocket (`backend/src/websocket/index.ts`)
- `emitEscortReport({ report, driverId? })` → `admin` room `escort:report`; assigned driver room `escort:report`.
- `emitEscortReportAck({ report, driverId? })` → `escort:report:acknowledged`.
- Trip-refresh: reuse the existing `emitTripStatus` pattern (emits `trip:status` to driver + employees + admin) so the escort change propagates to already-open driver/employee trip screens without a new client listener. Both the admin escort edit and the employee report call this after saving.

### Notification type
Extend the notification `type` union to include `'escort'` where SOS/`location` types are declared, and give it an icon in the admin Header (`frontend-vite/src/components/Header.tsx`) next to the SOS icon.

## Frontend — Admin (`frontend-vite`)

### Trip Management — editable escort cell
In `src/pages/TripManagement.tsx`, replace the read-only `<td>{trip.escort}</td>` (list view) with an editable control mirroring the vehicle-number cell pattern:
- A Yes/No `<select>` bound to `trip.escort`.
- A small text input for the escort name (optional), shown when escort = Yes.
- On change (debounced/onBlur for the name), call a new `updateTripEscort(tripId, escort, escortName)` API → `PUT /api/trips/:tripId/escort`, then `load()`.
- Frozen trips show escort read-only (same rule as the vehicle cell).
- Grid view: show `Escort: Yes — <name>` read-only (keep grid simple), or the same control if low effort. Read-only in grid is acceptable for v1.
- New API fn in `src/api/trips.ts`: `updateTripEscort`.

### Dashboard — Escort Reports panel
In `src/pages/Dashboard.tsx`, add an `EscortReportsPanel` component modeled on `SosPanel`:
- Loads via `getEscortReports()`, prepends live reports from realtime.
- Each row: employee name/contact, trip id, present Yes/No, escort name, time, acknowledge + delete buttons.
- Filter open/acknowledged/all like SOS.
- New API module `src/api/escortReports.ts`: `getEscortReports`, `acknowledgeEscortReport`, `deleteEscortReport`.

### Realtime (`src/context/RealtimeContext.tsx`)
- Subscribe to `escort:report` / `escort:report:acknowledged`, maintain an `escortReports` queue like `sosAlerts`, expose it from the context. (No forced popup — escort is informational, not an emergency; it just feeds the Dashboard panel.)

## Frontend — Employee app (`employee-web`)

### Display escort on the trip
- `src/pages/TripDetail.tsx` and the current-trip card in `src/pages/Dashboard.tsx`: add a row `Escort: Yes — <name>` (or `No`) from `trip.escort` / `trip.escortName`.
- Add `escort` + `escortName` to `EmployeeTrip` type in `src/api/types.ts`.

### Escort report button (SOS-style)
- New component `src/components/EscortButton.tsx`, modeled on `SosButton.tsx` but simpler:
  - A distinct floating button (different color/label from SOS, e.g. "Escort") so it's not confused with the emergency SOS.
  - Dialog: "Is an escort present?" Yes/No toggle + optional name text input → Submit.
  - Calls new `reportEscort(tripId, present, escortName, idempotencyKey)` in `src/api/trips.ts` → `POST /api/escort-report`.
  - Double-tap guard + idempotency key, like SosButton.
- Render it alongside `SosButton` on Dashboard and TripDetail (pass `tripId`).

## Frontend — Driver app (`driver-web`)

- `src/pages/TripDetail.tsx`: add a read-only row `Escort: Yes — <name>` (or `No`).
- Add `escort` + `escortName` to the driver trip type in `src/api/types.ts`.
- Driver app already listens to `trip:status`; the escort edit/report reuses that event so the driver screen refreshes live.

## Data Flow (employee report)

```
Employee app: EscortButton -> POST /api/escort-report {tripId, present, escortName}
  backend:
    createEscortReport() -> EscortReport doc
    Trip.escort = present; Trip.escortName = escortName; save
    emitEscortReport() -> admin + driver rooms ('escort:report')
    emitTripStatus()   -> driver + employees + admin ('trip:status')  // refresh escort display
    createNotification({type:'escort'}) -> admin bell
  admin Dashboard: EscortReportsPanel prepends the live report
  driver app: trip:status -> reload -> shows new escort
  employee app: trip:status -> reload -> shows new escort
```

## Testing

- **Backend**: unit test `createEscortReport` (creates report + updates trip). Route test for `POST /api/escort-report` (employee role, updates trip, returns DTO), admin `GET`/acknowledge/delete, and `PUT /api/trips/:id/escort`. Follow existing `backend/tests` patterns.
- **Frontend**: typecheck (`tsc --noEmit`) for all three apps. Manual: admin edits escort → employee/driver see it; employee reports → admin panel shows it + trip updates.

## Out of Scope (YAGNI)

- Photo attachment on escort reports.
- Escort as a managed roster/person entity (it stays a free-text name).
- SMS on escort reports (SOS-only).
- Escort history/audit beyond the EscortReport feed.

## Files Touched (summary)

**Backend:** `models/Trip.ts`, new `models/EscortReport.ts`, new `services/escort-report.service.ts`, new `routes/escort-report.ts`, `routes/trips.ts`, `app.ts`, `mappers.ts`, `types/dto.ts`, `websocket/index.ts`, notification type/service.

**Admin (`frontend-vite`):** `pages/TripManagement.tsx`, `pages/Dashboard.tsx`, new `api/escortReports.ts`, `api/trips.ts`, `api/types.ts`, `context/RealtimeContext.tsx`, `components/Header.tsx`.

**Employee (`employee-web`):** new `components/EscortButton.tsx`, `pages/TripDetail.tsx`, `pages/Dashboard.tsx`, `api/trips.ts`, `api/types.ts`.

**Driver (`driver-web`):** `pages/TripDetail.tsx`, `api/types.ts`.
