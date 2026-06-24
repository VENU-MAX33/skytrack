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
  frozen: boolean;
  startedAt: string | null;
  completedAt: string | null;
  verified: boolean;
  driver: { name: string; contact: string };
}

export interface EmployeeUser {
  id: string;
  name: string;
  contact: string;
  role: 'employee';
}

export interface OtpNotification {
  tripId: string;
  code: string | null;
}
