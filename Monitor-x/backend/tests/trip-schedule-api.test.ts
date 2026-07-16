import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app,
  clearDb,
  makeAdmin,
  makeDriver,
  makeEmployee,
  startTestDb,
  stopTestDb,
  tokenFor,
} from './helpers.js';
import { CompanyConfig } from '../src/models/CompanyConfig.js';
import { Route } from '../src/models/Route.js';
import { Vehicle } from '../src/models/Vehicle.js';

before(startTestDb);
after(stopTestDb);
beforeEach(clearDb);

async function setupScheduledTrip() {
  const admin = await makeAdmin('admin');
  const token = tokenFor(admin._id.toString(), 'admin');
  const driver = await makeDriver();
  await CompanyConfig.create({ name: 'MonitorX', lat: 12.9716, lng: 77.5946 });
  await Route.create({ routeId: 1, name: 'South Route', type: 'Both' });
  await Vehicle.create({
    rtoNo: 'KA01MX1000',
    vendor: 'Monitor Cabs',
    driverId: driver._id,
    active: 'Yes',
    lat: 12.9716,
    lng: 77.5946,
  });
  await makeEmployee({
    empId: 'EMP100',
    name: 'Scheduled Employee',
    route: 'South Route',
    distance: '8',
    latLong: '12.9352,77.6245',
  });
  const created = await request(app)
    .post('/api/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'PickUp',
      date: '2026-07-17',
      shiftTime: '09:00',
      vehicleNo: 'KA01MX1000',
      routeName: 'South Route',
      employeeIds: ['EMP100'],
    });
  assert.equal(created.status, 201);
  return { token, trip: created.body };
}

test('trip creation automatically calculates driver, stop and final times', async () => {
  const { trip } = await setupScheduledTrip();
  assert.equal(trip.schedule.mode, 'auto');
  assert.equal(trip.schedule.stops.length, 1);
  assert.equal(trip.schedule.stops[0].employeeId, 'EMP100');
  assert.ok(new Date(trip.schedule.driverReportAt) < new Date(trip.schedule.scheduledStartAt));
  assert.equal(trip.schedule.scheduledEndAt, '2026-07-17T03:25:00.000Z');
});

test('admin can override a calculated schedule and reset it to automatic', async () => {
  const { token, trip } = await setupScheduledTrip();
  const manual = await request(app)
    .put(`/api/trips/${trip.id}/schedule`)
    .set('Authorization', `Bearer ${token}`)
    .send({ driverReportAt: '2026-07-17T02:00:00.000Z' });
  assert.equal(manual.status, 200);
  assert.equal(manual.body.schedule.mode, 'manual');
  assert.equal(manual.body.schedule.driverReportAt, '2026-07-17T02:00:00.000Z');

  const automatic = await request(app)
    .put(`/api/trips/${trip.id}/schedule/recalculate`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(automatic.status, 200);
  assert.equal(automatic.body.schedule.mode, 'auto');
});
