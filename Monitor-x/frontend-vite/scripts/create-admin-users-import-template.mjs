import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public/templates/admin-users-import-template.xlsx');

const driverHeaders = [
  'Name', 'Gender', 'DL Number', 'Badge Number', 'Contact', 'Email', 'Vendor',
  'DL Effective From', 'DL Expiry', 'Address', 'Aadhaar', 'PAN', 'Induction Date',
  'First Vaccination', 'Second Vaccination', 'PVC Expiry', 'Medical Expiry', 'Active',
];

const employeeHeaders = [
  'Employee ID', 'Name', 'Gender', 'Contact', 'Email', 'Transport Type', 'Transport Mode',
  'Distance', 'Address', 'Location', 'Nodal Point', 'Manager', 'Pin Code', 'Shift Login',
  'Shift Logout', 'Fixed Shift', 'Lat/Long', 'Team', 'Special Need', 'Route', 'Active',
];

const driverRows = [
  ['Ravi Kumar', 'Male', 'KA012026000001', 'BDG-101', '9876500001', 'ravi@example.com', 'RGL', '2024-01-01', '2029-01-01', 'Indiranagar, Bengaluru', '123412341234', 'ABCDE1234F', '2026-01-01', '', '', '2027-01-01', '2027-01-01', 'Yes'],
  ['Meena Sharma', 'Female', 'KA012026000002', 'BDG-102', '9876500002', 'meena@example.com', 'RGL', '2024-02-01', '2029-02-01', 'Whitefield, Bengaluru', '123412341235', 'BCDEF2345G', '2026-01-02', '', '', '2027-02-01', '2027-02-01', 'Yes'],
  ['Arjun Nair', 'Male', 'KA012026000003', 'BDG-103', '9876500003', 'arjun@example.com', 'MoveFast', '2024-03-01', '2029-03-01', 'HSR Layout, Bengaluru', '123412341236', 'CDEFG3456H', '2026-01-03', '', '', '2027-03-01', '2027-03-01', 'Yes'],
];

const employeeRows = [
  ['EMP-1001', 'Asha Rao', 'Female', '9876543210', 'asha@example.com', 'Office Transport', 'cab', '12.5', 'Indiranagar, Bengaluru', 'Indiranagar', '', 'Team Lead', '560038', '09:00', '18:00', 'Yes', '12.9784,77.6408', 'Operations', 'No', 'Route 1', 'Yes'],
  ['EMP-1002', 'Vikram Singh', 'Male', '9876543211', 'vikram@example.com', 'Office Transport', 'cab', '8.2', 'Whitefield, Bengaluru', 'Whitefield', '', 'Team Lead', '560066', '09:00', '18:00', 'Yes', '12.9698,77.7500', 'Finance', 'No', 'Route 1', 'Yes'],
  ['EMP-1003', 'Nisha Patel', 'Female', '9876543212', 'nisha@example.com', 'Self Transport', 'self', '0', 'HSR Layout, Bengaluru', 'HSR Layout', '', 'Manager', '560102', '10:00', '19:00', 'No', '', 'People', 'No', '', 'Yes'],
];

function dataSheet(headers, rows) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map((header) => ({ wch: Math.min(28, Math.max(14, header.length + 3)) }));
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}${rows.length + 1}` };
  return sheet;
}

const instructions = XLSX.utils.aoa_to_sheet([
  ['MonitorX Admin — Driver and Employee Excel Import'],
  ['How to use', 'Use the Drivers or Employees sheet. Keep the header row unchanged, delete the example rows, add your records, save as .xlsx, then upload from the matching admin page.'],
  ['Required driver fields', 'Name, DL Number, Contact'],
  ['Required employee fields', 'Employee ID, Name, Contact, and Lat/Long when Transport Type is Office Transport'],
  ['Date format', 'Use YYYY-MM-DD. Times should use HH:MM, for example 09:00.'],
  ['Location format', 'Lat/Long must be latitude,longitude, for example 12.9784,77.6408.'],
  ['Allowed values', 'Active: Yes or No. Fixed Shift and Special Need: Yes or No. Transport Type: Office Transport or Self Transport.'],
  ['Important', 'The admin panel previews and validates every row before saving. Duplicate IDs, DL numbers, or contacts are rejected without partially importing the file.'],
]);
instructions['!cols'] = [{ wch: 28 }, { wch: 110 }];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
XLSX.utils.book_append_sheet(workbook, dataSheet(driverHeaders, driverRows), 'Drivers');
XLSX.utils.book_append_sheet(workbook, dataSheet(employeeHeaders, employeeRows), 'Employees');

mkdirSync(dirname(output), { recursive: true });
XLSX.writeFile(workbook, output);
console.log(`Wrote ${output}`);
