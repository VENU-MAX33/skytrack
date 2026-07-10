// Mirrors backend DTOs in Monitor-x/backend/src/types/dto.ts

export interface DriverTripEmployee {
  id: string;
  name: string;
  contact: string;
  latLong: string;
  location: string;
  nodalPoint: string;
  shiftLogin: string;
  shiftLogout: string;
  verified: boolean;
}

export interface DriverTrip {
  id: string;
  status: string;
  statusColor: string;
  type: string;
  date: string;
  shiftTime: string;
  escort: string;
  location: string;
  route: string;
  vehicleNo: string;
  vendor: string;
  frozen: boolean;
  startedAt: string | null;
  completedAt: string | null;
  employees: DriverTripEmployee[];
}

export interface DriverUser {
  name: string;
  contact: string;
  vendor: string;
  email: string;
  badgeNumber?: string;
  dlNumber?: string;
  role: 'driver';
}

export interface DriverVehicle {
  rtoNo: string;
  model: string;
  vehicleType: string;
}

export interface DriverProfile {
  name: string;
  contact: string;
  vendor: string;
  email: string;
  badgeNumber: string;
  dlNumber: string;
  vehicle: DriverVehicle | null;
}

export interface SosAlert {
  id: string;
  status: string;
  location: string;
  createdAt: string;
  acknowledgedBy: string;
  acknowledgedAt: string | null;
  tripId: string | null;
  employee: { id: string; name: string; contact: string };
  driver: { name: string; contact: string } | null;
}

export interface CompanyConfig {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface EmpLocationUpdate {
  employeeMongoId: string;
  empId: string;
  empName: string;
  tripId: string;
  lat: number;
  lng: number;
  timestamp: string;
}
