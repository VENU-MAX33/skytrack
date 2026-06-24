import type { HydratedDocument, Types } from 'mongoose';
import type {
  Employee,
  Vehicle,
  Driver,
  Route,
  Trip,
  RosterEntry,
  VehiclePosition,
  DriverTrip,
  EmployeeTrip,
  SosAlert,
} from './types/dto.js';
import type { EmployeeDoc } from './models/Employee.js';
import type { VehicleDoc } from './models/Vehicle.js';
import type { DriverDoc } from './models/Driver.js';
import type { RouteDoc } from './models/Route.js';
import type { TripDoc } from './models/Trip.js';
import type { RosterDoc } from './models/Roster.js';
import type { SOSAlertDoc } from './models/SOSAlert.js';
import { STATUS_COLORS, type TripStatus } from './lib/statusBuckets.js';

export function toEmployeeDTO(doc: HydratedDocument<EmployeeDoc>): Employee {
  return {
    id: doc.empId,
    name: doc.name,
    gender: doc.gender,
    contact: doc.contact,
    email: doc.email,
    transportType: doc.transportType,
    transportMode: doc.transportMode,
    distance: doc.distance,
    address: doc.address,
    location: doc.location,
    nodalPoint: doc.nodalPoint,
    manager: doc.manager,
    pinCode: doc.pinCode,
    shiftLogin: doc.shiftLogin,
    shiftLogout: doc.shiftLogout,
    fixedShift: doc.fixedShift,
    latLong: doc.latLong,
    team: doc.team,
    specialNeed: doc.specialNeed,
    route: doc.route,
    active: doc.active,
  };
}

export function toDriverDTO(doc: HydratedDocument<DriverDoc>): Driver {
  return {
    name: doc.name,
    gender: doc.gender,
    dlNumber: doc.dlNumber,
    badgeNumber: doc.badgeNumber,
    contact: doc.contact,
    email: doc.email,
    vendor: doc.vendor,
    dlEffectiveFrom: doc.dlEffectiveFrom,
    dlExpiry: doc.dlExpiry,
    address: doc.address,
    inductionDate: doc.inductionDate,
    firstVaccination: doc.firstVaccination,
    secondVaccination: doc.secondVaccination,
    pvcExpiry: doc.pvcExpiry,
    medicalExpiry: doc.medicalExpiry,
    active: doc.active,
  };
}

// Vehicle docs are queried with .populate('driverId') so the DTO can carry driver name/contact.
type PopulatedVehicle = Omit<HydratedDocument<VehicleDoc>, 'driverId'> & {
  driverId: HydratedDocument<DriverDoc> | null;
};

export function toVehicleDTO(doc: PopulatedVehicle): Vehicle {
  return {
    rtoNo: doc.rtoNo,
    seatCount: doc.seatCount,
    model: doc.model,
    taxExpiry: doc.taxExpiry,
    insuranceEnd: doc.insuranceEnd,
    permitEnd: doc.permitEnd,
    fcExpiry: doc.fcExpiry,
    emissionExpiry: doc.emissionExpiry,
    maintenanceDue: doc.maintenanceDue,
    vehicleType: doc.vehicleType,
    vendor: doc.vendor,
    imei: doc.imei,
    driver: doc.driverId?.name ?? '',
    driverContact: doc.driverId?.contact ?? '',
    billingType: doc.billingType,
    fuelType: doc.fuelType,
    inductionDate: doc.inductionDate,
    expired: doc.expired,
    active: doc.active,
  };
}

export function toVehiclePositionDTO(doc: HydratedDocument<VehicleDoc>): VehiclePosition {
  return {
    rtoNo: doc.rtoNo,
    lat: doc.lat,
    lng: doc.lng,
    status: doc.trackStatus,
    speed: doc.speed,
  };
}

export function toRouteDTO(doc: HydratedDocument<RouteDoc>, count: number): Route {
  return {
    id: doc.routeId,
    name: doc.name,
    count,
    type: doc.type,
  };
}

// Trip docs are queried with .populate('vehicleId driverId routeId employeeIds').
type PopulatedTrip = Omit<HydratedDocument<TripDoc>, 'vehicleId' | 'driverId' | 'routeId' | 'employeeIds'> & {
  vehicleId: HydratedDocument<VehicleDoc> | null;
  driverId: HydratedDocument<DriverDoc> | null;
  routeId: HydratedDocument<RouteDoc> | null;
  employeeIds: HydratedDocument<EmployeeDoc>[];
};

export function toTripDTO(doc: PopulatedTrip): Trip {
  const verifiedSet = new Set((doc.verifiedEmployees ?? []).map((v) => v.toString()));
  return {
    id: doc.tripId,
    status: doc.status,
    statusColor: STATUS_COLORS[doc.status as TripStatus] ?? 'text-[#777777]',
    type: doc.type,
    date: doc.date,
    escort: doc.escort,
    shiftTime: doc.shiftTime,
    empCount: doc.employeeIds.length,
    location: doc.location || doc.routeId?.name || '',
    route: doc.routeId?.name || '',
    vendor: doc.vendor || doc.vehicleId?.vendor || '',
    vehicleNo: doc.vehicleId?.rtoNo ?? '',
    frozen: doc.frozen ?? false,
    employees: doc.employeeIds.map(e => toEmployeeDTO(e)),
    verifiedEmployeeIds: doc.employeeIds
      .filter((e) => verifiedSet.has(e._id.toString()))
      .map((e) => e.empId),
  };
}

function statusColor(status: string): string {
  return STATUS_COLORS[status as TripStatus] ?? 'text-[#777777]';
}

function isVerified(verified: Types.ObjectId[], empId: Types.ObjectId): boolean {
  return verified.some((v) => v.equals(empId));
}

// Driver app: full trip with per-employee verification flags.
export function toDriverTripDTO(doc: PopulatedTrip): DriverTrip {
  return {
    id: doc.tripId,
    status: doc.status,
    statusColor: statusColor(doc.status),
    type: doc.type,
    date: doc.date,
    shiftTime: doc.shiftTime,
    escort: doc.escort,
    location: doc.location || doc.routeId?.name || '',
    route: doc.routeId?.name || '',
    vehicleNo: doc.vehicleId?.rtoNo ?? '',
    vendor: doc.vendor || doc.vehicleId?.vendor || '',
    frozen: doc.frozen ?? false,
    startedAt: doc.startedAt ? doc.startedAt.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    employees: doc.employeeIds.map((e) => ({
      id: e.empId,
      name: e.name,
      contact: e.contact,
      latLong: e.latLong,
      location: e.location,
      nodalPoint: e.nodalPoint,
      shiftLogin: e.shiftLogin,
      shiftLogout: e.shiftLogout,
      verified: isVerified(doc.verifiedEmployees, e._id),
    })),
  };
}

// Employee app: trip from the requesting employee's perspective.
export function toEmployeeTripDTO(doc: PopulatedTrip, selfId: Types.ObjectId): EmployeeTrip {
  return {
    id: doc.tripId,
    status: doc.status,
    statusColor: statusColor(doc.status),
    type: doc.type,
    date: doc.date,
    shiftTime: doc.shiftTime,
    location: doc.location || doc.routeId?.name || '',
    route: doc.routeId?.name || '',
    vehicleNo: doc.vehicleId?.rtoNo ?? '',
    vendor: doc.vendor || doc.vehicleId?.vendor || '',
    frozen: doc.frozen ?? false,
    startedAt: doc.startedAt ? doc.startedAt.toISOString() : null,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    verified: isVerified(doc.verifiedEmployees, selfId),
    driver: { name: doc.driverId?.name ?? '', contact: doc.driverId?.contact ?? '' },
  };
}

type PopulatedSos = Omit<HydratedDocument<SOSAlertDoc>, 'employeeId' | 'driverId' | 'tripId'> & {
  employeeId: HydratedDocument<EmployeeDoc> | null;
  driverId: HydratedDocument<DriverDoc> | null;
  tripId: HydratedDocument<TripDoc> | null;
  createdAt: Date;
};

export function toSosDTO(doc: PopulatedSos): SosAlert {
  return {
    id: doc._id.toString(),
    status: doc.status,
    location: doc.location,
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

type PopulatedRoster = Omit<HydratedDocument<RosterDoc>, 'employeeId'> & {
  employeeId: HydratedDocument<EmployeeDoc> | null;
};

export function toRosterDTO(doc: PopulatedRoster): RosterEntry {
  return {
    id: doc._id.toString(),
    name: doc.employeeId?.name ?? '',
    empId: doc.employeeId?.empId ?? '',
    shiftTime: doc.timing,
    route: doc.employeeId?.route ?? '',
    location: doc.employeeId?.location ?? '',
    status: doc.status,
  };
}
