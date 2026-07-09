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
  role: 'driver';
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

export interface EmpLocationUpdate {
  employeeMongoId: string;
  empId: string;
  empName: string;
  tripId: string;
  lat: number;
  lng: number;
  timestamp: string;
}
