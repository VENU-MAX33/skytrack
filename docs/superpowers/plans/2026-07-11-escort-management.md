# Escort Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make trip escort a real end-to-end concept — admin sets escort Yes/No + name on a trip; employee & driver apps display it; the employee can report escort status from a SOS-style button that both updates the trip and shows in a live admin "Escort Reports" panel.

**Architecture:** Add `escortName` to the Trip. A new `EscortReport` model + routes + WebSocket events mirror the existing SOS pipeline exactly (`SOSAlert`). An employee report creates an `EscortReport`, overwrites the trip's `escort`/`escortName`, emits `escort:report` to admins, and re-emits `trip:status` so driver/employee screens refresh. Admin Dashboard gets an `EscortReportsPanel` modeled on `SosPanel`.

**Tech Stack:** Backend — Node + Express + Mongoose + TypeScript, tests via `node:test` + `supertest` + `mongodb-memory-server`. Frontends — React + Vite + TypeScript (admin `frontend-vite`, `employee-web`, `driver-web`), gated on `tsc --noEmit` (no frontend test runner).

## Global Constraints

- Escort presence values are the exact strings `'Yes'` and `'No'` (matches existing `Trip.escort`).
- `EscortReport` mirrors `SOSAlert` conventions: `status` is `'open' | 'acknowledged'`, `timestamps: true`, index `{ status: 1, createdAt: -1 }`.
- Escort reports carry **no photo** (unlike SOS).
- Reuse the existing `emitTripStatus` event (`'trip:status'`) to refresh driver/employee screens — do not invent a new client listener.
- Employee escort button must be visually distinct from the emergency SOS button (different color + label "Escort").
- Backend route files import with `.js` extensions (ESM/NodeNext), e.g. `import { Trip } from '../models/Trip.js'`.
- Run all backend commands from `Monitor-x/backend`; frontend commands from each app's dir.

---

## Task 1: Add `escortName` to Trip model, DTOs, and mappers

**Files:**
- Modify: `Monitor-x/backend/src/models/Trip.ts`
- Modify: `Monitor-x/backend/src/types/dto.ts`
- Modify: `Monitor-x/backend/src/mappers.ts`
- Test: `Monitor-x/backend/tests/escort.test.ts` (new)

**Interfaces:**
- Produces: `Trip.escortName: string` (mongoose field, default `''`); DTO fields `Trip.escortName`, `DriverTrip.escortName`, `EmployeeTrip.escortName`; mappers `toTripDTO`, `toDriverTripDTO`, `toEmployeeTripDTO` now emit `escortName`.

- [ ] **Step 1: Write the failing test**

Create `Monitor-x/backend/tests/escort.test.ts`:

```ts
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, startTestDb, stopTestDb, clearDb, makeDriver, makeEmployee, makeAdmin, tokenFor } from './helpers.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { Route } from '../src/models/Route.js';

before(startTestDb);
after(stopTestDb);
beforeEach(clearDb);

async function setupTrip() {
  const admin = await makeAdmin('admin');
  const token = tokenFor(admin._id.toString(), 'admin');
  const driver = await makeDriver();
  await Route.create({ routeId: 1, name: 'Whitefield', type: 'Both' });
  await Vehicle.create({ rtoNo: 'KA01AB1111', vendor: 'Acme', driverId: driver._id, active: 'Yes' });
  const emp = await makeEmployee({ route: 'Whitefield', active: 'Yes' });
  const create = await request(app).post('/api/trips').set('Authorization', `Bearer ${token}`)
    .send({ type: 'PickUp', vehicleNo: 'KA01AB1111', routeName: 'Whitefield', employeeIds: [emp.empId] });
  return { token, tripId: create.body.id as string, empId: emp._id.toString() };
}

test('trip DTO exposes escortName defaulting to empty', async () => {
  const { token, tripId } = await setupTrip();
  const res = await request(app).get('/api/trips').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  const trip = res.body.find((t: { id: string }) => t.id === tripId);
  assert.equal(trip.escort, 'No');
  assert.equal(trip.escortName, '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Monitor-x/backend && npm test -- tests/escort.test.ts` (or `npm test` then read output)
Expected: FAIL — `trip.escortName` is `undefined`, assertion `undefined === ''` fails.

- [ ] **Step 3: Add the model field**

In `Monitor-x/backend/src/models/Trip.ts`, in `interface TripDoc` after `escort: string;`:

```ts
  escortName: string;
```

In `tripSchema` after `escort: { type: String, default: 'No' },`:

```ts
  escortName: { type: String, default: '' },
```

- [ ] **Step 4: Add DTO fields**

In `Monitor-x/backend/src/types/dto.ts`:
- In `interface Trip`, after `escort: string;` add `escortName: string;`
- In `interface DriverTrip`, after `escort: string;` add `escortName: string;`
- In `interface EmployeeTrip`, after `frozen: boolean;` add `escortName: string;` (EmployeeTrip has no `escort` today — add both):
  - Also add `escort: string;` to `interface EmployeeTrip` (after `vendor: string;`).

- [ ] **Step 5: Emit in mappers**

In `Monitor-x/backend/src/mappers.ts`:
- In `toTripDTO`, after `escort: doc.escort,` add `escortName: doc.escortName ?? '',`
- In `toDriverTripDTO`, after `escort: doc.escort,` add `escortName: doc.escortName ?? '',`
- In `toEmployeeTripDTO`, after `vendor: doc.vendor || doc.vehicleId?.vendor || '',` add:
```ts
    escort: doc.escort,
    escortName: doc.escortName ?? '',
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd Monitor-x/backend && npm test -- tests/escort.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Monitor-x/backend/src/models/Trip.ts Monitor-x/backend/src/types/dto.ts Monitor-x/backend/src/mappers.ts Monitor-x/backend/tests/escort.test.ts
git commit -m "feat(escort): add escortName to trip model, dtos, mappers"
```

---

## Task 2: Admin route — `PUT /api/trips/:id/escort`

**Files:**
- Modify: `Monitor-x/backend/src/routes/trips.ts`
- Test: `Monitor-x/backend/tests/escort.test.ts`

**Interfaces:**
- Produces: `PUT /api/trips/:id/escort` (mounted under `requireBackOffice`), body `{ escort: 'Yes'|'No', escortName?: string }`, returns trip DTO with updated `escort`/`escortName`; emits `trip:status`.

- [ ] **Step 1: Write the failing test**

Append to `Monitor-x/backend/tests/escort.test.ts`:

```ts
test('admin sets escort Yes + name on a trip', async () => {
  const { token, tripId } = await setupTrip();
  const res = await request(app)
    .put(`/api/trips/${encodeURIComponent(tripId)}/escort`)
    .set('Authorization', `Bearer ${token}`)
    .send({ escort: 'Yes', escortName: 'Ravi Kumar' });
  assert.equal(res.status, 200);
  assert.equal(res.body.escort, 'Yes');
  assert.equal(res.body.escortName, 'Ravi Kumar');
});

test('escort=No clears the escort name', async () => {
  const { token, tripId } = await setupTrip();
  await request(app).put(`/api/trips/${encodeURIComponent(tripId)}/escort`)
    .set('Authorization', `Bearer ${token}`).send({ escort: 'Yes', escortName: 'Ravi' });
  const res = await request(app).put(`/api/trips/${encodeURIComponent(tripId)}/escort`)
    .set('Authorization', `Bearer ${token}`).send({ escort: 'No' });
  assert.equal(res.body.escort, 'No');
  assert.equal(res.body.escortName, '');
});

test('rejects an invalid escort value', async () => {
  const { token, tripId } = await setupTrip();
  const res = await request(app).put(`/api/trips/${encodeURIComponent(tripId)}/escort`)
    .set('Authorization', `Bearer ${token}`).send({ escort: 'Maybe' });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Monitor-x/backend && npm test -- tests/escort.test.ts`
Expected: FAIL — route returns 404 (unknown path) or similar.

- [ ] **Step 3: Add the route**

In `Monitor-x/backend/src/routes/trips.ts`, immediately after the `PUT /:id/vehicle` handler (the `tripsRouter.put('/:id/vehicle', ...)` block), add:

```ts
// PUT /api/trips/:id/escort — set whether a trip has an escort, plus optional name.
tripsRouter.put(
  '/:id/escort',
  asyncHandler(async (req, res) => {
    const { escort, escortName } = req.body as { escort?: string; escortName?: string };
    if (escort !== 'Yes' && escort !== 'No') {
      throw new HttpError(400, "escort must be 'Yes' or 'No'");
    }
    const doc = await Trip.findOne({ tripId: req.params.id });
    if (!doc) throw new HttpError(404, 'Trip not found');

    doc.escort = escort;
    // No escort -> name is meaningless; store name only when escort is present.
    doc.escortName = escort === 'Yes' ? (escortName ?? '').trim() : '';
    await doc.save();
    await doc.populate(TRIP_POPULATE);
    const populated = doc as unknown as Populated;
    const dto = toTripDTO(populated);

    emitTripStatus({
      trip: dto,
      driverId: populated.driverId?._id.toString() ?? '',
      employeeIds: populated.employeeIds.map((e) => e._id.toString()),
    });
    res.json(dto);
  })
);
```

(`emitTripStatus` and `HttpError` are already imported in this file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Monitor-x/backend && npm test -- tests/escort.test.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add Monitor-x/backend/src/routes/trips.ts Monitor-x/backend/tests/escort.test.ts
git commit -m "feat(escort): admin PUT /api/trips/:id/escort route"
```

---

## Task 3: EscortReport model, service, DTO, mapper, WebSocket + notification type

**Files:**
- Create: `Monitor-x/backend/src/models/EscortReport.ts`
- Create: `Monitor-x/backend/src/services/escort-report.service.ts`
- Modify: `Monitor-x/backend/src/types/dto.ts`
- Modify: `Monitor-x/backend/src/mappers.ts`
- Modify: `Monitor-x/backend/src/websocket/index.ts`
- Modify: `Monitor-x/backend/src/models/Notification.ts`

**Interfaces:**
- Produces:
  - `EscortReport` model with doc `{ employeeId, tripId?, driverId?, present, escortName, employeeName, employeeContact, status, acknowledgedBy?, acknowledgedAt? }` + `createdAt`.
  - `createEscortReport(input): Promise<HydratedDocument<EscortReportDoc>>` and `acknowledgeEscortReport(id, by): Promise<... | null>`.
  - `EscortReportDTO` type + `toEscortReportDTO(doc)` mapper.
  - `emitEscortReport({ report, driverId? })`, `emitEscortReportAck({ report, driverId? })`.
  - `NotificationType` now includes `'escort'`.

- [ ] **Step 1: Create the model**

Create `Monitor-x/backend/src/models/EscortReport.ts`:

```ts
import { Schema, model, Types } from 'mongoose';

export type EscortReportStatus = 'open' | 'acknowledged';

export interface EscortReportDoc {
  employeeId: Types.ObjectId;
  tripId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  present: string; // 'Yes' | 'No' — did the employee see an escort
  escortName: string;
  employeeName: string;   // denormalized for admin display
  employeeContact: string;
  status: EscortReportStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

const escortReportSchema = new Schema<EscortReportDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', default: null },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    present: { type: String, enum: ['Yes', 'No'], default: 'No' },
    escortName: { type: String, default: '' },
    employeeName: { type: String, default: '' },
    employeeContact: { type: String, default: '' },
    status: { type: String, enum: ['open', 'acknowledged'], default: 'open' },
    acknowledgedBy: { type: String, default: '' },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

escortReportSchema.index({ status: 1, createdAt: -1 });

export const EscortReport = model<EscortReportDoc>('EscortReport', escortReportSchema);
```

- [ ] **Step 2: Create the service**

Create `Monitor-x/backend/src/services/escort-report.service.ts`:

```ts
import type { Types, HydratedDocument } from 'mongoose';
import { EscortReport, type EscortReportDoc } from '../models/EscortReport.js';

interface CreateEscortReportInput {
  employeeId: Types.ObjectId;
  tripId?: Types.ObjectId;
  driverId?: Types.ObjectId;
  present: string;
  escortName?: string;
  employeeName?: string;
  employeeContact?: string;
}

export async function createEscortReport(
  input: CreateEscortReportInput
): Promise<HydratedDocument<EscortReportDoc>> {
  return EscortReport.create({
    employeeId: input.employeeId,
    tripId: input.tripId ?? null,
    driverId: input.driverId ?? null,
    present: input.present === 'Yes' ? 'Yes' : 'No',
    escortName: input.present === 'Yes' ? (input.escortName ?? '').trim() : '',
    employeeName: input.employeeName ?? '',
    employeeContact: input.employeeContact ?? '',
    status: 'open',
  });
}

export async function acknowledgeEscortReport(
  id: string,
  acknowledgedBy: string
): Promise<HydratedDocument<EscortReportDoc> | null> {
  return EscortReport.findByIdAndUpdate(
    id,
    { status: 'acknowledged', acknowledgedBy, acknowledgedAt: new Date() },
    { new: true }
  );
}
```

- [ ] **Step 3: Add the DTO type**

In `Monitor-x/backend/src/types/dto.ts`, after the `SosAlert` interface add:

```ts
export interface EscortReportDTO {
  id: string;
  status: string; // 'open' | 'acknowledged'
  present: string; // 'Yes' | 'No'
  escortName: string;
  createdAt: string;
  acknowledgedBy: string;
  acknowledgedAt: string | null;
  tripId: string | null;
  employee: { id: string; name: string; contact: string };
  driver: { name: string; contact: string } | null;
}
```

- [ ] **Step 4: Add the mapper**

In `Monitor-x/backend/src/mappers.ts`:
- Add an import for the model doc type near the other model imports:
```ts
import type { EscortReportDoc } from './models/EscortReport.js';
```
(Match the existing import style in the file; if models are imported as values elsewhere use `import type` for the doc interface.)
- Also import the DTO type where the other DTO types are imported (add `EscortReportDTO` to the existing `from './types/dto.js'` import list).
- After `toSosDTO`, add:

```ts
type PopulatedEscortReport = Omit<HydratedDocument<EscortReportDoc>, 'employeeId' | 'driverId' | 'tripId'> & {
  employeeId: HydratedDocument<EmployeeDoc> | null;
  driverId: HydratedDocument<DriverDoc> | null;
  tripId: HydratedDocument<TripDoc> | null;
  createdAt: Date;
};

export function toEscortReportDTO(doc: PopulatedEscortReport): EscortReportDTO {
  return {
    id: doc._id.toString(),
    status: doc.status,
    present: doc.present,
    escortName: doc.escortName ?? '',
    createdAt: doc.createdAt.toISOString(),
    acknowledgedBy: doc.acknowledgedBy ?? '',
    acknowledgedAt: doc.acknowledgedAt ? doc.acknowledgedAt.toISOString() : null,
    tripId: doc.tripId?.tripId ?? null,
    employee: {
      id: doc.employeeId?.empId ?? '',
      name: doc.employeeId?.name ?? '',
      contact: doc.employeeId?.contact ?? '',
    },
    driver: doc.driverId ? { name: doc.driverId.name, contact: doc.driverId.contact } : null,
  };
}
```

- [ ] **Step 5: Add WebSocket emitters**

In `Monitor-x/backend/src/websocket/index.ts`, after `emitSosAck`, add:

```ts
/** Broadcast an employee's escort report to admins and the assigned driver. */
export function emitEscortReport(payload: { report: unknown; driverId?: string }): void {
  const i = getIo();
  i.to(rooms.admin).emit('escort:report', payload.report);
  if (payload.driverId) i.to(rooms.driver(payload.driverId)).emit('escort:report', payload.report);
}

export function emitEscortReportAck(payload: { report: unknown; driverId?: string }): void {
  const i = getIo();
  i.to(rooms.admin).emit('escort:report:acknowledged', payload.report);
  if (payload.driverId) i.to(rooms.driver(payload.driverId)).emit('escort:report:acknowledged', payload.report);
}
```

- [ ] **Step 6: Add the notification type**

In `Monitor-x/backend/src/models/Notification.ts` line 3, change:

```ts
export type NotificationType = 'sos' | 'location-request' | 'employee-location' | 'feedback' | 'info';
```
to add `'escort'`:
```ts
export type NotificationType = 'sos' | 'location-request' | 'employee-location' | 'feedback' | 'escort' | 'info';
```

- [ ] **Step 7: Typecheck**

Run: `cd Monitor-x/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add Monitor-x/backend/src/models/EscortReport.ts Monitor-x/backend/src/services/escort-report.service.ts Monitor-x/backend/src/types/dto.ts Monitor-x/backend/src/mappers.ts Monitor-x/backend/src/websocket/index.ts Monitor-x/backend/src/models/Notification.ts
git commit -m "feat(escort): EscortReport model, service, dto, mapper, ws + notification type"
```

---

## Task 4: Escort-report router (employee POST + admin GET/ack/delete) and mount it

**Files:**
- Create: `Monitor-x/backend/src/routes/escort-report.ts`
- Modify: `Monitor-x/backend/src/app.ts`
- Test: `Monitor-x/backend/tests/escort.test.ts`

**Interfaces:**
- Consumes: `createEscortReport`, `acknowledgeEscortReport`, `toEscortReportDTO`, `emitEscortReport`, `emitEscortReportAck`, `emitTripStatus`, `createNotification`.
- Produces: `escortReportRouter`; routes `POST /api/escort-report` (employee), `GET /api/escort-report` (admin), `PUT /api/escort-report/:id/acknowledge` (admin), `DELETE /api/escort-report/:id` (admin).

- [ ] **Step 1: Write the failing test**

Append to `Monitor-x/backend/tests/escort.test.ts` (add employee helpers inline):

```ts
import { Trip } from '../src/models/Trip.js';

async function setupEmployeeOnTrip() {
  const admin = await makeAdmin('admin');
  const adminToken = tokenFor(admin._id.toString(), 'admin');
  const driver = await makeDriver();
  await Route.create({ routeId: 1, name: 'Whitefield', type: 'Both' });
  await Vehicle.create({ rtoNo: 'KA01AB1111', vendor: 'Acme', driverId: driver._id, active: 'Yes' });
  const emp = await makeEmployee({ route: 'Whitefield', active: 'Yes' });
  const create = await request(app).post('/api/trips').set('Authorization', `Bearer ${adminToken}`)
    .send({ type: 'PickUp', vehicleNo: 'KA01AB1111', routeName: 'Whitefield', employeeIds: [emp.empId] });
  const empToken = tokenFor(emp._id.toString(), 'employee');
  return { adminToken, empToken, tripId: create.body.id as string };
}

test('employee report creates a record AND updates the trip', async () => {
  const { adminToken, empToken, tripId } = await setupEmployeeOnTrip();
  const res = await request(app).post('/api/escort-report')
    .set('Authorization', `Bearer ${empToken}`)
    .send({ tripId, present: 'Yes', escortName: 'Sita' });
  assert.equal(res.status, 201);
  assert.equal(res.body.present, 'Yes');
  assert.equal(res.body.escortName, 'Sita');

  // trip updated
  const updated = await Trip.findOne({ tripId });
  assert.equal(updated!.escort, 'Yes');
  assert.equal(updated!.escortName, 'Sita');

  // admin can list it
  const list = await request(app).get('/api/escort-report').set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
});

test('admin acknowledges an escort report', async () => {
  const { adminToken, empToken, tripId } = await setupEmployeeOnTrip();
  const created = await request(app).post('/api/escort-report')
    .set('Authorization', `Bearer ${empToken}`).send({ tripId, present: 'No' });
  const ack = await request(app).put(`/api/escort-report/${created.body.id}/acknowledge`)
    .set('Authorization', `Bearer ${adminToken}`).send({});
  assert.equal(ack.status, 200);
  assert.equal(ack.body.status, 'acknowledged');
});

test('employee role cannot list escort reports', async () => {
  const { empToken } = await setupEmployeeOnTrip();
  const res = await request(app).get('/api/escort-report').set('Authorization', `Bearer ${empToken}`);
  assert.equal(res.status, 403);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Monitor-x/backend && npm test -- tests/escort.test.ts`
Expected: FAIL — `POST /api/escort-report` returns 404.

- [ ] **Step 3: Create the router**

Create `Monitor-x/backend/src/routes/escort-report.ts`:

```ts
import { Router } from 'express';
import { Types } from 'mongoose';
import { Trip } from '../models/Trip.js';
import { Employee } from '../models/Employee.js';
import { EscortReport } from '../models/EscortReport.js';
import { User } from '../models/User.js';
import { toEscortReportDTO, toTripDTO } from '../mappers.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireRole } from '../middleware/auth.js';
import { idempotent } from '../middleware/idempotency.js';
import { createEscortReport, acknowledgeEscortReport } from '../services/escort-report.service.js';
import { createNotification } from '../services/notification.service.js';
import { emitEscortReport, emitEscortReportAck, emitTripStatus } from '../websocket/index.js';

export const escortReportRouter = Router();

const REPORT_POPULATE = 'employeeId driverId tripId';
const TRIP_POPULATE = 'vehicleId driverId routeId employeeIds';
type PopulatedReport = Parameters<typeof toEscortReportDTO>[0];
type PopulatedTrip = Parameters<typeof toTripDTO>[0];

// POST /api/escort-report — employee reports whether an escort is present
escortReportRouter.post(
  '/',
  requireRole('employee'),
  idempotent(),
  asyncHandler(async (req, res) => {
    const { tripId, present, escortName } = req.body as {
      tripId?: string; present?: string; escortName?: string;
    };
    if (present !== 'Yes' && present !== 'No') {
      throw new HttpError(400, "present must be 'Yes' or 'No'");
    }

    let tripDoc = null;
    let driverObjectId: Types.ObjectId | undefined;
    let tripObjectId: Types.ObjectId | undefined;
    if (tripId) {
      tripDoc = await Trip.findOne({ tripId });
      if (tripDoc) {
        tripObjectId = tripDoc._id;
        driverObjectId = tripDoc.driverId ?? undefined;
      }
    }

    const employee = await Employee.findById(req.auth!.sub);

    const report = await createEscortReport({
      employeeId: new Types.ObjectId(req.auth!.sub),
      tripId: tripObjectId,
      driverId: driverObjectId,
      present,
      escortName,
      employeeName: employee?.name,
      employeeContact: employee?.contact,
    });
    await report.populate(REPORT_POPULATE);
    const dto = toEscortReportDTO(report as unknown as PopulatedReport);

    emitEscortReport({ report: dto, driverId: driverObjectId?.toString() });

    // Update the trip so driver + employee apps reflect the reported escort.
    if (tripDoc) {
      tripDoc.escort = present;
      tripDoc.escortName = present === 'Yes' ? (escortName ?? '').trim() : '';
      await tripDoc.save();
      await tripDoc.populate(TRIP_POPULATE);
      const populated = tripDoc as unknown as PopulatedTrip;
      emitTripStatus({
        trip: toTripDTO(populated),
        driverId: populated.driverId?._id.toString() ?? '',
        employeeIds: populated.employeeIds.map((e) => e._id.toString()),
      });
    }

    await createNotification({
      type: 'escort',
      title: `Escort update from ${dto.employee.name || 'Employee'}`,
      body: dto.present === 'Yes'
        ? `Escort present${dto.escortName ? `: ${dto.escortName}` : ''}`
        : 'No escort present',
      refId: dto.id,
      link: '/',
    });

    res.status(201).json(dto);
  })
);

// GET /api/escort-report — admin lists reports (newest first)
escortReportRouter.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status } = req.query as { status?: string };
    const query = status ? { status } : {};
    const docs = await EscortReport.find(query).sort({ createdAt: -1 }).limit(100).populate(REPORT_POPULATE);
    res.json(docs.map((d) => toEscortReportDTO(d as unknown as PopulatedReport)));
  })
);

// PUT /api/escort-report/:id/acknowledge — admin acknowledges
escortReportRouter.put(
  '/:id/acknowledge',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const admin = await User.findById(req.auth!.sub);
    const updated = await acknowledgeEscortReport(req.params.id, admin?.name ?? 'Admin');
    if (!updated) throw new HttpError(404, 'Escort report not found');
    await updated.populate(REPORT_POPULATE);
    const dto = toEscortReportDTO(updated as unknown as PopulatedReport);
    emitEscortReportAck({ report: dto, driverId: updated.driverId?.toString() });
    res.json(dto);
  })
);

// DELETE /api/escort-report/:id — admin removes a report
escortReportRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const doc = await EscortReport.findByIdAndDelete(req.params.id);
    if (!doc) throw new HttpError(404, 'Escort report not found');
    res.status(204).end();
  })
);
```

- [ ] **Step 4: Mount the router**

In `Monitor-x/backend/src/app.ts`:
- After `import { sosRouter } from './routes/sos.js';` add:
```ts
import { escortReportRouter } from './routes/escort-report.js';
```
- After the line `app.use('/api/sos', sosRouter);` add:
```ts
  app.use('/api/escort-report', escortReportRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd Monitor-x/backend && npm test -- tests/escort.test.ts`
Expected: PASS (all escort tests).

- [ ] **Step 6: Run the full backend test suite (no regressions)**

Run: `cd Monitor-x/backend && npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add Monitor-x/backend/src/routes/escort-report.ts Monitor-x/backend/src/app.ts Monitor-x/backend/tests/escort.test.ts
git commit -m "feat(escort): escort-report router (employee report + admin feed)"
```

---

## Task 5: Admin API client — escort reports + trip escort update + Trip type

**Files:**
- Create: `Monitor-x/frontend-vite/src/api/escortReports.ts`
- Modify: `Monitor-x/frontend-vite/src/api/trips.ts`
- Modify: `Monitor-x/frontend-vite/src/api/types.ts`

**Interfaces:**
- Produces: `EscortReport` type; `getEscortReports(status?)`, `acknowledgeEscortReport(id)`, `deleteEscortReport(id)`; `updateTripEscort(tripId, escort, escortName)`; `Trip.escortName?: string`.

- [ ] **Step 1: Add `escortName` to the admin Trip type**

In `Monitor-x/frontend-vite/src/api/types.ts`, in `interface Trip`, after `escort: string;` add:
```ts
  escortName?: string;
```

- [ ] **Step 2: Add the trip escort update call**

In `Monitor-x/frontend-vite/src/api/trips.ts`, after the `changeTripVehicle` function add:
```ts
export async function updateTripEscort(
  tripId: string,
  escort: 'Yes' | 'No',
  escortName: string
): Promise<Trip> {
  return apiPut<Trip>(`/api/trips/${encodeURIComponent(tripId)}/escort`, { escort, escortName });
}
```

- [ ] **Step 3: Create the escort-reports API module**

Create `Monitor-x/frontend-vite/src/api/escortReports.ts`:
```ts
import { apiGet, apiPut, apiDelete } from './client';

export interface EscortReport {
  id: string;
  status: string; // 'open' | 'acknowledged'
  present: string; // 'Yes' | 'No'
  escortName: string;
  createdAt: string;
  acknowledgedBy: string;
  acknowledgedAt: string | null;
  tripId: string | null;
  employee: { id: string; name: string; contact: string };
  driver: { name: string; contact: string } | null;
}

export function getEscortReports(status?: string): Promise<EscortReport[]> {
  return apiGet<EscortReport[]>(`/api/escort-report${status ? `?status=${status}` : ''}`);
}

export function acknowledgeEscortReport(id: string): Promise<EscortReport> {
  return apiPut<EscortReport>(`/api/escort-report/${id}/acknowledge`, {});
}

export async function deleteEscortReport(id: string): Promise<void> {
  await apiDelete(`/api/escort-report/${id}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `cd Monitor-x/frontend-vite && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Monitor-x/frontend-vite/src/api/escortReports.ts Monitor-x/frontend-vite/src/api/trips.ts Monitor-x/frontend-vite/src/api/types.ts
git commit -m "feat(escort): admin api client for escort reports + trip escort update"
```

---

## Task 6: Admin Trip Management — editable escort cell

**Files:**
- Modify: `Monitor-x/frontend-vite/src/pages/TripManagement.tsx`

**Interfaces:**
- Consumes: `updateTripEscort` from `../api/trips`.

- [ ] **Step 1: Import the API + add saving state**

In `Monitor-x/frontend-vite/src/pages/TripManagement.tsx`:
- Update the import from `../api` to also include `updateTripEscort`. The existing import is:
```ts
import { getTrips, getRosters, getVehicles, createTrip, freezeTrip, deleteTrip, changeTripVehicle } from "../api";
```
Change it to add `updateTripEscort`:
```ts
import { getTrips, getRosters, getVehicles, createTrip, freezeTrip, deleteTrip, changeTripVehicle, updateTripEscort } from "../api";
```
(If `updateTripEscort` is not re-exported from `../api`, import it from `../api/trips` instead. Verify `../api/index.ts` re-exports `./trips`; the existing `changeTripVehicle` is imported from `../api`, so add the new fn to the same barrel — check `Monitor-x/frontend-vite/src/api/index.ts` and add `updateTripEscort` to its export if needed.)

- Near the other action state (after `const [changingVehicle, setChangingVehicle] = useState<string | null>(null);`), add:
```ts
  const [savingEscort, setSavingEscort] = useState<string | null>(null);

  async function handleEscortChange(tripId: string, escort: 'Yes' | 'No', escortName: string) {
    setSavingEscort(tripId);
    try {
      await updateTripEscort(tripId, escort, escortName);
      toast.success(`Trip ${tripId} escort updated`);
      load();
    } catch (err) {
      toast.error(`Could not update escort: ${(err as Error).message}`);
    } finally {
      setSavingEscort(null);
    }
  }
```

- [ ] **Step 2: Replace the read-only escort cell (list view)**

In the list-view table body, replace:
```tsx
                    <td>{trip.escort}</td>
```
with:
```tsx
                    <td onClick={(e) => e.stopPropagation()}>
                      {trip.frozen ? (
                        <span>{trip.escort}{trip.escort === 'Yes' && trip.escortName ? ` · ${trip.escortName}` : ''}</span>
                      ) : (
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <select
                            value={trip.escort === 'Yes' ? 'Yes' : 'No'}
                            disabled={savingEscort === trip.id}
                            onChange={(e) => handleEscortChange(trip.id, e.target.value as 'Yes' | 'No', e.target.value === 'Yes' ? (trip.escortName ?? '') : '')}
                            className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px]"
                            title="Set whether this trip has an escort"
                          >
                            <option value="No">No escort</option>
                            <option value="Yes">Escort: Yes</option>
                          </select>
                          {trip.escort === 'Yes' && (
                            <input
                              type="text"
                              defaultValue={trip.escortName ?? ''}
                              disabled={savingEscort === trip.id}
                              onBlur={(e) => {
                                const name = e.target.value.trim();
                                if (name !== (trip.escortName ?? '')) handleEscortChange(trip.id, 'Yes', name);
                              }}
                              placeholder="Escort name (optional)"
                              className="border border-[#E0E4E9] bg-white rounded px-2 py-1 text-[12px]"
                            />
                          )}
                        </div>
                      )}
                    </td>
```

- [ ] **Step 3: Show escort in the grid view (read-only)**

In the grid-view card body, in the `<div className="text-[12px] text-[#595959] space-y-1">` block (after `<div>{trip.location}</div>`), add:
```tsx
                {trip.escort === 'Yes' && (
                  <div>Escort: Yes{trip.escortName ? ` · ${trip.escortName}` : ''}</div>
                )}
```

- [ ] **Step 4: Typecheck**

Run: `cd Monitor-x/frontend-vite && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Monitor-x/frontend-vite/src/pages/TripManagement.tsx Monitor-x/frontend-vite/src/api/index.ts
git commit -m "feat(escort): editable escort cell in admin Trip Management"
```

---

## Task 7: Admin realtime + Dashboard Escort Reports panel + Header icon

**Files:**
- Modify: `Monitor-x/frontend-vite/src/context/RealtimeContext.tsx`
- Modify: `Monitor-x/frontend-vite/src/pages/Dashboard.tsx`
- Modify: `Monitor-x/frontend-vite/src/components/Header.tsx`
- Modify: `Monitor-x/frontend-vite/src/api/notifications.ts`

**Interfaces:**
- Consumes: `getEscortReports`, `acknowledgeEscortReport`, `deleteEscortReport`, `EscortReport`.
- Produces: `useRealtime().escortReports: EscortReport[]`, `dismissEscortReport(id)`.

- [ ] **Step 1: Add escort reports to RealtimeContext**

In `Monitor-x/frontend-vite/src/context/RealtimeContext.tsx`:
- Add an import at top: `import type { EscortReport } from '../api/escortReports';`
- In `interface RealtimeContextValue`, after `dismissSos: (id: string) => void;` add:
```ts
  /** Queue of escort reports from employees (newest first). */
  escortReports: EscortReport[];
  dismissEscortReport: (id: string) => void;
```
- After `const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);` add:
```ts
  const [escortReports, setEscortReports] = useState<EscortReport[]>([]);
```
- Inside the realtime `useEffect`, after the `onEmpLoc` handler definition add:
```ts
    const onEscort = (report: EscortReport) =>
      setEscortReports((prev) => (prev.some((r) => r.id === report.id) ? prev : [report, ...prev]));
    const onEscortAck = (report: EscortReport) =>
      setEscortReports((prev) => prev.map((r) => (r.id === report.id ? report : r)));
```
- After `socket.on('employee:location', onEmpLoc);` add:
```ts
    socket.on('escort:report', onEscort);
    socket.on('escort:report:acknowledged', onEscortAck);
```
- In the cleanup `return () => { ... }`, after `socket.off('employee:location', onEmpLoc);` add:
```ts
      socket.off('escort:report', onEscort);
      socket.off('escort:report:acknowledged', onEscortAck);
```
- After the `dismissSos` `useCallback`, add:
```ts
  const dismissEscortReport = useCallback(
    (id: string) => setEscortReports((prev) => prev.filter((r) => r.id !== id)),
    []
  );
```
- In the provider `value={{ ... }}`, add `escortReports, dismissEscortReport,` to the object.

- [ ] **Step 2: Add the notification type + Header icon**

In `Monitor-x/frontend-vite/src/api/notifications.ts` line 3, change:
```ts
export type NotificationType = 'sos' | 'location-request' | 'employee-location' | 'info';
```
to:
```ts
export type NotificationType = 'sos' | 'location-request' | 'employee-location' | 'escort' | 'info';
```

In `Monitor-x/frontend-vite/src/components/Header.tsx`, in the `typeIcon` switch, after the `case "employee-location":` line add:
```tsx
    case "escort": return <UserCheck className="w-4 h-4 text-[#6a5ca1]" />;
```
And add `UserCheck` to the existing `lucide-react` import in that file.

- [ ] **Step 3: Add the EscortReportsPanel to the admin Dashboard**

In `Monitor-x/frontend-vite/src/pages/Dashboard.tsx`:
- Add imports near the top:
```ts
import { getEscortReports, acknowledgeEscortReport, deleteEscortReport, type EscortReport } from "../api/escortReports";
import { UserCheck } from "lucide-react";
```
(If `UserCheck` is already imported from lucide-react, merge it into that import instead.)
- Add this component near `SosPanel` (above the default export component):
```tsx
function EscortReportsPanel() {
  const toast = useToast();
  const { escortReports: liveReports } = useRealtime();
  const [reports, setReports] = useState<EscortReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getEscortReports().then(setReports).catch(() => {});
  }, []);

  useEffect(() => {
    if (!liveReports.length) return;
    setReports((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      liveReports.forEach((r) => byId.set(r.id, r));
      return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, [liveReports]);

  async function handleAck(id: string) {
    setBusy(id);
    try {
      const updated = await acknowledgeEscortReport(id);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      toast.success("Escort report acknowledged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this escort report?")) return;
    setBusy(id);
    try {
      await deleteEscortReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Escort report deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="dashboard-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-4 h-4 text-[#6a5ca1]" />
        <h2 className="text-[14px] font-semibold text-[#222222]">Escort Reports</h2>
      </div>
      {reports.length === 0 ? (
        <div className="text-[13px] text-[#595959]">No escort reports.</div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border border-[#E0E4E9] rounded p-2">
              <div className="text-[12px]">
                <div className="font-medium text-[#222222]">
                  {r.employee.name || "Employee"}
                  {r.tripId ? <span className="text-[#595959]"> · {r.tripId}</span> : null}
                </div>
                <div className="text-[#595959]">
                  {r.present === "Yes" ? `Escort present${r.escortName ? ` · ${r.escortName}` : ""}` : "No escort present"}
                </div>
                <div className="text-[11px] text-[#848484]">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "open" ? (
                  <button
                    onClick={() => handleAck(r.id)}
                    disabled={busy === r.id}
                    className="text-[12px] text-[#0047B2] hover:underline disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                ) : (
                  <span className="text-[11px] text-[#18751C]">✓ {r.acknowledgedBy || "Acknowledged"}</span>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={busy === r.id}
                  className="text-[12px] text-[#D22630] hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
- Render `<EscortReportsPanel />` in the dashboard layout next to where `<SosPanel />` is rendered (place it immediately after the `<SosPanel />` element in the JSX).

- [ ] **Step 4: Typecheck**

Run: `cd Monitor-x/frontend-vite && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Monitor-x/frontend-vite/src/context/RealtimeContext.tsx Monitor-x/frontend-vite/src/pages/Dashboard.tsx Monitor-x/frontend-vite/src/components/Header.tsx Monitor-x/frontend-vite/src/api/notifications.ts
git commit -m "feat(escort): admin realtime + dashboard escort reports panel"
```

---

## Task 8: Employee app — types, report API, and escort display

**Files:**
- Modify: `Monitor-x/employee-web/src/api/types.ts`
- Modify: `Monitor-x/employee-web/src/api/trips.ts`
- Modify: `Monitor-x/employee-web/src/pages/TripDetail.tsx`
- Modify: `Monitor-x/employee-web/src/pages/Dashboard.tsx`

**Interfaces:**
- Produces: `EmployeeTrip.escort`, `EmployeeTrip.escortName`; `reportEscort(tripId, present, escortName, idempotencyKey)`.

- [ ] **Step 1: Add escort fields to EmployeeTrip type**

In `Monitor-x/employee-web/src/api/types.ts`, in the `EmployeeTrip` interface add (near `vendor`):
```ts
  escort: string;
  escortName: string;
```

- [ ] **Step 2: Add the reportEscort API call**

In `Monitor-x/employee-web/src/api/trips.ts`, after the `triggerSos` function add:
```ts
export function reportEscort(
  tripId: string | undefined,
  present: 'Yes' | 'No',
  escortName?: string,
  idempotencyKey?: string
): Promise<unknown> {
  return apiPost(
    '/api/escort-report',
    { tripId, present, escortName },
    idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  );
}
```

- [ ] **Step 3: Show escort on TripDetail**

In `Monitor-x/employee-web/src/pages/TripDetail.tsx`, inside the second `<div className="card p-4">` (the one with Vehicle No / Vendor / Driver), after the `<Row label="Vendor" ... />` line add:
```tsx
          <Row label="Escort" value={trip.escort === 'Yes' ? `Yes${trip.escortName ? ` · ${trip.escortName}` : ''}` : 'No'} />
```

- [ ] **Step 4: Show escort on Dashboard current-trip card**

In `Monitor-x/employee-web/src/pages/Dashboard.tsx`, in the "Vehicle & Driver" card, after `<Row label="Vendor" value={current.vendor || '—'} />` add:
```tsx
            <Row label="Escort" value={current.escort === 'Yes' ? `Yes${current.escortName ? ` · ${current.escortName}` : ''}` : 'No'} />
```

- [ ] **Step 5: Typecheck**

Run: `cd Monitor-x/employee-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add Monitor-x/employee-web/src/api/types.ts Monitor-x/employee-web/src/api/trips.ts Monitor-x/employee-web/src/pages/TripDetail.tsx Monitor-x/employee-web/src/pages/Dashboard.tsx
git commit -m "feat(escort): employee app escort display + report api"
```

---

## Task 9: Employee app — EscortButton (SOS-style report)

**Files:**
- Create: `Monitor-x/employee-web/src/components/EscortButton.tsx`
- Modify: `Monitor-x/employee-web/src/pages/Dashboard.tsx`
- Modify: `Monitor-x/employee-web/src/pages/TripDetail.tsx`

**Interfaces:**
- Consumes: `reportEscort` from `../api/trips`.

- [ ] **Step 1: Create the EscortButton component**

Create `Monitor-x/employee-web/src/components/EscortButton.tsx`:
```tsx
import { useRef, useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { reportEscort } from '../api/trips';
import { useToast } from '../context/ToastContext';

export default function EscortButton({ tripId }: { tripId?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState<'Yes' | 'No'>('Yes');
  const [name, setName] = useState('');
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setOpen(false);
    setPresent('Yes');
    setName('');
  }

  async function submit() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await reportEscort(tripId, present, present === 'Yes' ? name.trim() : '', idempotencyKey);
      toast.success('Escort update sent');
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send escort update');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      {/* Distinct from the red SOS FAB: purple, sits above it */}
      <button
        className="fixed right-4 bottom-24 z-[9000] flex items-center gap-1.5 rounded-full bg-[#6a5ca1] px-4 py-3 text-white text-[13px] font-semibold shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Report escort status"
      >
        <UserCheck size={18} /> Escort
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4">
          <div role="dialog" aria-modal="true" aria-label="Report escort" className="card w-full max-w-[400px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck size={20} className="text-[#6a5ca1]" />
                <div className="text-[16px] font-bold">Is an escort present?</div>
              </div>
              <button onClick={reset} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['Yes', 'No'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPresent(v)}
                  className={`flex-1 py-2 rounded-lg border text-[14px] ${
                    present === v ? 'bg-[#6a5ca1] text-white border-[#6a5ca1]' : 'border-[#ddd] text-[#444]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {present === 'Yes' && (
              <input
                className="input text-[13px] mb-4"
                placeholder="Escort name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <div className="flex gap-2">
              <button className="btn btn-outline flex-1" onClick={reset} disabled={busy}>Cancel</button>
              <button className="btn btn-green flex-1" onClick={submit} disabled={busy}>
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```
(If the shared CSS classes `input`, `btn`, `btn-outline`, `btn-green`, `card` are not all present, they are — they are used by `SosButton.tsx` and the pages in this app.)

- [ ] **Step 2: Render it on TripDetail**

In `Monitor-x/employee-web/src/pages/TripDetail.tsx`:
- Add import: `import EscortButton from '../components/EscortButton';`
- Immediately before `<SosButton tripId={trip.id} />` add:
```tsx
      <EscortButton tripId={trip.id} />
```

- [ ] **Step 3: Render it on Dashboard**

In `Monitor-x/employee-web/src/pages/Dashboard.tsx`:
- Add import: `import EscortButton from '../components/EscortButton';`
- Immediately before `<SosButton tripId={current?.id} />` add:
```tsx
      <EscortButton tripId={current?.id} />
```

- [ ] **Step 4: Typecheck**

Run: `cd Monitor-x/employee-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Monitor-x/employee-web/src/components/EscortButton.tsx Monitor-x/employee-web/src/pages/TripDetail.tsx Monitor-x/employee-web/src/pages/Dashboard.tsx
git commit -m "feat(escort): employee EscortButton (SOS-style report)"
```

---

## Task 10: Driver app — escort display

**Files:**
- Modify: `Monitor-x/driver-web/src/api/types.ts`
- Modify: `Monitor-x/driver-web/src/pages/TripDetail.tsx`

**Interfaces:**
- Produces: `DriverTrip.escortName`.

- [ ] **Step 1: Add escortName to the driver trip type**

In `Monitor-x/driver-web/src/api/types.ts`, in `interface DriverTrip`, after `escort: string;` add:
```ts
  escortName: string;
```

- [ ] **Step 2: Show escort in the driver TripDetail header**

In `Monitor-x/driver-web/src/pages/TripDetail.tsx`, in the `<header ...>` block, replace this subtitle div:
```tsx
          <div className="text-[12px] opacity-90">
            {trip.type} · {trip.route || trip.location} · {trip.shiftTime}
          </div>
```
with:
```tsx
          <div className="text-[12px] opacity-90">
            {trip.type} · {trip.route || trip.location} · {trip.shiftTime}
          </div>
          {trip.escort === 'Yes' && (
            <div className="text-[12px] font-semibold opacity-95">
              Escort: Yes{trip.escortName ? ` · ${trip.escortName}` : ''}
            </div>
          )}
```

- [ ] **Step 3: Typecheck**

Run: `cd Monitor-x/driver-web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add Monitor-x/driver-web/src/api/types.ts Monitor-x/driver-web/src/pages/TripDetail.tsx
git commit -m "feat(escort): driver app escort display"
```

---

## Final Verification

- [ ] **Backend:** `cd Monitor-x/backend && npm test` — all suites pass.
- [ ] **Typecheck all frontends:**
  - `cd Monitor-x/frontend-vite && npx tsc --noEmit`
  - `cd Monitor-x/employee-web && npx tsc --noEmit`
  - `cd Monitor-x/driver-web && npx tsc --noEmit`
- [ ] **Manual smoke (optional, needs local stack):** admin sets escort Yes + name on a trip → employee & driver TripDetail show it; employee taps Escort → picks No → admin Dashboard "Escort Reports" shows the report and the trip flips to No escort.

## Notes / Deviations allowed during execution

- If `../api/index.ts` (admin barrel) does not re-export `updateTripEscort`, import it directly from `../api/trips` in Task 6 instead of the barrel.
- If a frontend already imports `UserCheck`/`Car`/`X` from lucide-react, merge rather than duplicate the import.
- Exact JSX anchor lines may shift as files change; match on the quoted surrounding code, not line numbers.
