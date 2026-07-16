// Mirrors backend DTOs in Monitor-x/backend/src/types/dto.ts

export interface EmployeeTrip {
  id: string;
  status: string;
  statusColor: string;
  type: string;
  date: string;
  shiftTime: string;
  location: string;
  route: string;
  vehicleNo: string;
  vendor: string;
  escort: string;
  escortName: string;
  frozen: boolean;
  startedAt: string | null;
  completedAt: string | null;
  verified: boolean;
  driver: { name: string; contact: string };
  schedule: TripSchedule | null;
}

export interface TripScheduleStop {
  employeeId: string;
  employeeName: string;
  sequence: number;
  plannedAt: string;
  liveEtaAt: string | null;
  distanceMeters: number;
  durationSeconds: number;
}

export interface TripSchedule {
  shiftDeadlineAt: string | null;
  scheduledStartAt: string | null;
  driverReportAt: string | null;
  scheduledEndAt: string | null;
  mode: 'auto' | 'manual';
  calculatedAt: string | null;
  etaUpdatedAt: string | null;
  distanceMeters: number;
  durationSeconds: number;
  trafficModel: string;
  stops: TripScheduleStop[];
}

export interface EmployeeUser {
  id: string;
  name: string;
  contact: string;
  role: 'employee';
}

export interface EmployeeProfile {
  id: string;
  name: string;
  gender: string;
  contact: string;
  email: string;
  transportType: string;
  transportMode: string;
  address: string;
  location: string;
  nodalPoint: string;
  manager: string;
  shiftLogin: string;
  shiftLogout: string;
  team: string;
  route: string;
  active: string;
}

export interface CompanyConfig {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface OtpNotification {
  tripId: string;
}
