import type { Driver, Employee, Vehicle } from '../api/types';
import { ApiError } from '../api/client';
import type { ExcelRow } from './excel';

export interface ImportColumnDefinition {
  key: string;
  label?: string;
  required?: boolean;
}

export const EMPLOYEE_HEADERS = [
  'Employee ID', 'Name', 'Gender', 'Contact', 'Email', 'Transport Type', 'Transport Mode',
  'Distance', 'Address', 'Location', 'Nodal Point', 'Manager', 'Pin Code', 'Shift Login',
  'Shift Logout', 'Fixed Shift', 'Lat/Long', 'Team', 'Special Need', 'Route', 'Active',
];

export const DRIVER_HEADERS = [
  'Name', 'Gender', 'DL Number', 'Badge Number', 'Contact', 'Email', 'Vendor',
  'DL Effective From', 'DL Expiry', 'Address', 'Aadhaar', 'PAN', 'Induction Date',
  'First Vaccination', 'Second Vaccination', 'PVC Expiry', 'Medical Expiry', 'Active',
];

export const VEHICLE_HEADERS = [
  'Vehicle RTO No', 'Seat Count', 'Model', 'Tax Expiry', 'Insurance End', 'Permit End',
  'FC Expiry', 'Emission Expiry', 'Maintenance Due', 'Vehicle Type', 'Vendor', 'IMEI',
  'Driver', 'Billing Type', 'Fuel Type', 'Induction Date', 'Expired', 'Active',
];

export const TRIP_HEADERS = [
  'Date', 'Type', 'Shift Time', 'Route Name', 'Employee IDs', 'Vehicle No', 'Escort',
  'Driver Name', 'Driver Contact', 'DL Number', 'Driver Vendor', 'Vehicle Model',
  'Seat Count', 'Vehicle Type', 'Fuel Type',
];

export const IMPORT_ALIASES: Record<string, string> = {
  'Emp ID': 'Employee ID',
  'Employee Id': 'Employee ID',
  'EMP ID': 'Employee ID',
  'Mobile': 'Contact',
  'Phone': 'Contact',
  'Phone Number': 'Contact',
  'Latitude Longitude': 'Lat/Long',
  'Lat Long': 'Lat/Long',
  'Login Time': 'Shift Login',
  'Logout Time': 'Shift Logout',
  'DL No': 'DL Number',
  'Driving Licence': 'DL Number',
  'Vehicle Number': 'Vehicle RTO No',
  'RTO No': 'Vehicle RTO No',
  'RTO Number': 'Vehicle RTO No',
  'Vehicle RTO Number': 'Vehicle RTO No',
  'Vehicle RTO No.': 'Vehicle RTO No',
  'Trip Date': 'Date',
  'Trip Type': 'Type',
  'Employee Ids': 'Employee IDs',
  'Employees': 'Employee IDs',
  'Driver Mobile': 'Driver Contact',
  'Driver DL Number': 'DL Number',
  'RTO': 'Vehicle No',
};

function value(row: ExcelRow, key: string, fallback = ''): string {
  return (row[key] ?? fallback).trim();
}

export function employeeFromRow(row: ExcelRow): Employee {
  return {
    id: value(row, 'Employee ID'), name: value(row, 'Name'), gender: value(row, 'Gender', 'Male'),
    contact: value(row, 'Contact'), email: value(row, 'Email'),
    transportType: value(row, 'Transport Type', 'Office Transport'),
    transportMode: value(row, 'Transport Mode', 'cab'), distance: value(row, 'Distance'),
    address: value(row, 'Address'), location: value(row, 'Location'), nodalPoint: value(row, 'Nodal Point'),
    manager: value(row, 'Manager'), pinCode: value(row, 'Pin Code'), shiftLogin: value(row, 'Shift Login'),
    shiftLogout: value(row, 'Shift Logout'), fixedShift: value(row, 'Fixed Shift', 'No'),
    latLong: value(row, 'Lat/Long'), team: value(row, 'Team'), specialNeed: value(row, 'Special Need', 'No'),
    route: value(row, 'Route'), active: value(row, 'Active', 'Yes'),
  };
}

export function driverFromRow(row: ExcelRow, defaultVendor = ''): Driver {
  return {
    name: value(row, 'Name'), gender: value(row, 'Gender', 'Male'), dlNumber: value(row, 'DL Number'),
    badgeNumber: value(row, 'Badge Number'), contact: value(row, 'Contact'), email: value(row, 'Email'),
    vendor: value(row, 'Vendor', defaultVendor), dlEffectiveFrom: value(row, 'DL Effective From'),
    dlExpiry: value(row, 'DL Expiry'), address: value(row, 'Address'), aadhaar: value(row, 'Aadhaar'),
    pan: value(row, 'PAN'), inductionDate: value(row, 'Induction Date'),
    firstVaccination: value(row, 'First Vaccination'), secondVaccination: value(row, 'Second Vaccination'),
    pvcExpiry: value(row, 'PVC Expiry'), medicalExpiry: value(row, 'Medical Expiry'),
    active: value(row, 'Active', 'Yes'),
  };
}

export function driverFromTripRow(row: ExcelRow): Driver {
  return driverFromRow({
    Name: value(row, 'Driver Name'), Contact: value(row, 'Driver Contact'),
    'DL Number': value(row, 'DL Number'), Vendor: value(row, 'Driver Vendor'),
    Gender: 'Male', Active: 'Yes',
  });
}

export function vehicleFromRow(row: ExcelRow, defaultVendor = ''): Vehicle {
  return {
    rtoNo: (value(row, 'Vehicle RTO No') || value(row, 'Vehicle No')).toUpperCase(), seatCount: value(row, 'Seat Count'),
    model: value(row, 'Model') || value(row, 'Vehicle Model'), taxExpiry: value(row, 'Tax Expiry'),
    insuranceEnd: value(row, 'Insurance End'), permitEnd: value(row, 'Permit End'),
    fcExpiry: value(row, 'FC Expiry'), emissionExpiry: value(row, 'Emission Expiry'),
    maintenanceDue: value(row, 'Maintenance Due'), vehicleType: value(row, 'Vehicle Type'),
    vendor: value(row, 'Vendor') || value(row, 'Driver Vendor', defaultVendor), imei: value(row, 'IMEI'),
    driver: value(row, 'Driver') || value(row, 'Driver Name'), driverContact: '',
    billingType: value(row, 'Billing Type'), fuelType: value(row, 'Fuel Type'),
    inductionDate: value(row, 'Induction Date'), expired: value(row, 'Expired', 'No'),
    active: value(row, 'Active', 'Yes'),
  };
}

export function requiredColumns(headers: string[], required: string[]): string[] {
  const present = new Set(headers);
  return required.filter((header) => !present.has(header));
}

export function rowErrors(rows: ExcelRow[], validate: (row: ExcelRow, index: number) => string[]): Record<number, string[]> {
  return Object.fromEntries(rows.map((row, index) => [index, validate(row, index)]));
}

export function bulkErrorsFromApi(error: unknown): Record<number, string[]> {
  if (!(error instanceof ApiError) || !error.details || typeof error.details !== 'object') return {};
  const details = error.details as { errors?: { row?: number; reasons?: string[]; reason?: string }[] };
  if (!Array.isArray(details.errors)) return {};
  return Object.fromEntries(details.errors
    .filter((item) => typeof item.row === 'number')
    .map((item) => [Math.max(0, item.row! - 2), item.reasons ?? (item.reason ? [item.reason] : ['Invalid row'])]));
}

export const EMPLOYEE_EXAMPLE: ExcelRow = {
  'Employee ID': 'EMP-1001', Name: 'Asha Rao', Gender: 'Female', Contact: '9876543210',
  Email: 'asha@example.com', 'Transport Type': 'Office Transport', 'Transport Mode': 'cab',
  Distance: '12.5', Address: 'Indiranagar, Bengaluru', Location: 'Indiranagar',
  'Nodal Point': '', Manager: 'Team Lead', 'Pin Code': '560038', 'Shift Login': '09:00',
  'Shift Logout': '18:00', 'Fixed Shift': 'Yes', 'Lat/Long': '12.9784,77.6408',
  Team: 'Operations', 'Special Need': 'No', Route: 'Route 1', Active: 'Yes',
};

export const DRIVER_EXAMPLE: ExcelRow = {
  Name: 'Ravi Kumar', Gender: 'Male', 'DL Number': 'KA012026000001', 'Badge Number': 'BDG-101',
  Contact: '9876500001', Email: 'ravi@example.com', Vendor: 'RGL', 'DL Effective From': '2024-01-01',
  'DL Expiry': '2029-01-01', Address: 'Bengaluru', Aadhaar: '123412341234', PAN: 'ABCDE1234F',
  'Induction Date': '2026-01-01', 'First Vaccination': '', 'Second Vaccination': '',
  'PVC Expiry': '2027-01-01', 'Medical Expiry': '2027-01-01', Active: 'Yes',
};

export const VEHICLE_EXAMPLE: ExcelRow = {
  'Vehicle RTO No': 'KA01AB1234', 'Seat Count': '4', Model: 'SEDAN', 'Tax Expiry': '2027-01-01',
  'Insurance End': '2027-01-01', 'Permit End': '2027-01-01', 'FC Expiry': '2027-01-01',
  'Emission Expiry': '2027-01-01', 'Maintenance Due': '2026-10-01', 'Vehicle Type': '4 Seater',
  Vendor: 'RGL', IMEI: '123456789012345', Driver: 'Ravi Kumar', 'Billing Type': '4 Seater',
  'Fuel Type': 'Diesel', 'Induction Date': '2026-01-01', Expired: 'No', Active: 'Yes',
};

export const TRIP_EXAMPLE: ExcelRow = {
  Date: '2026-07-17', Type: 'PickUp', 'Shift Time': '09:00', 'Route Name': 'Route 1',
  'Employee IDs': 'EMP-1001,EMP-1002', 'Vehicle No': 'KA01AB1234', Escort: 'No',
  'Driver Name': 'Ravi Kumar', 'Driver Contact': '9876500001', 'DL Number': 'KA012026000001',
  'Driver Vendor': 'RGL', 'Vehicle Model': 'SEDAN', 'Seat Count': '4',
  'Vehicle Type': '4 Seater', 'Fuel Type': 'Diesel',
};
