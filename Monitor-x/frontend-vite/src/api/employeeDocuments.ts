import type { EmployeeDocumentDTO } from './types';
import { apiGet, apiPost, apiDelete } from './client';

export function getEmployeeDocs(empId: string): Promise<EmployeeDocumentDTO[]> {
  return apiGet<EmployeeDocumentDTO[]>(`/api/employees/${empId}/documents`);
}

export function uploadEmployeeDoc(
  empId: string,
  data: { name: string; mimeType: string; base64: string }
): Promise<EmployeeDocumentDTO> {
  return apiPost<EmployeeDocumentDTO>(`/api/employees/${empId}/documents`, data);
}

export function getEmployeeDocFull(empId: string, docId: string): Promise<EmployeeDocumentDTO & { base64: string }> {
  return apiGet<EmployeeDocumentDTO & { base64: string }>(`/api/employees/${empId}/documents/${docId}`);
}

export function deleteEmployeeDoc(empId: string, docId: string): Promise<void> {
  return apiDelete(`/api/employees/${empId}/documents/${docId}`);
}
