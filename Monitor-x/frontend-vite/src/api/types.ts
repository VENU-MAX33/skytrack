export interface Employee {
  id: string;
  name: string;
  gender: string;
  contact: string;
  email: string;
  transportType: string;
  transportMode: string;
  distance: string;
  address: string;
  location: string;
  nodalPoint: string;
  manager: string;
  pinCode: string;
  shiftLogin: string;
  shiftLogout: string;
  fixedShift: string;
  latLong: string;
  team: string;
  specialNeed: string;
  route: string;
  active: string;
}

export interface Vehicle {
  rtoNo: string;
  seatCount: string;
  model: string;
  taxExpiry: string;
  insuranceEnd: string;
  permitEnd: string;
  fcExpiry: string;
  emissionExpiry: string;
  maintenanceDue: string;
  vehicleType: string;
  vendor: string;
  imei: string;
  driver: string;
  driverContact: string;
  billingType: string;
  fuelType: string;
  inductionDate: string;
  expired: string;
  active: string;
}

export interface Driver {
  name: string;
  gender: string;
  dlNumber: string;
  badgeNumber: string;
  contact: string;
  email: string;
  vendor: string;
  dlEffectiveFrom: string;
  dlExpiry: string;
  address: string;
  inductionDate: string;
  firstVaccination: string;
  secondVaccination: string;
  pvcExpiry: string;
  medicalExpiry: string;
  active: string;
}

export interface Route {
  id: number;
  name: string;
  count: number;
  type: string;
}

export interface Trip {
  id: string;
  status: string;
  statusColor: string;
  type: string;
  date: string;
  escort: string;
  shiftTime: string;
  empCount: number;
  location: string;
  route?: string;
  vendor: string;
  vehicleNo: string;
  frozen?: boolean;
  employees?: Employee[];
  verifiedEmployeeIds?: string[];
}

export interface RosterEntry {
  id: string;
  name: string;
  empId: string;
  shiftTime: string;
  route: string;
  location?: string;
  status: string;
}

export interface DashboardStats {
  rostering: { label: string; value: number; subLabel: string }[];
  employeeTrips: { label: string; value: number; subLabel: string }[];
  liveTrips: { label: string; value: number; subLabel: string }[];
  tripsInProgress: TripTableRow[];
  upcomingTrips: TripTableRow[];
  completedTrips: TripTableRow[];
  autoCancel: TripTableRow[];
  vendorPerformance: VendorPerformanceRow[];
  approval: ApprovalData;
}

export interface TripTableRow {
  type: string;
  count: number;
  vehicle: string;
  vendor: string;
  driver: string;
}

export interface VendorPerformanceRow {
  vendor: string;
  percentage: number;
  tripCount: number;
  completed: number;
}

export interface ApprovalData {
  rostering: { pending: number; approved: number };
  employeeAddressChange: { pending: number; approved: number };
  workspaceBooking: { pending: number; approved: number };
}

export interface TripFilters {
  fromDate?: string;
  toDate?: string;
  shiftTime?: string;
  tripType?: string;
  vendor?: string;
  search?: string;
  status?: string;
}

export interface VehiclePosition {
  rtoNo: string;
  lat: number;
  lng: number;
  status: string;
  speed: number;
}
