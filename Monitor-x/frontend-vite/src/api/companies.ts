import { apiGet, apiPost, apiPut } from './client';

export interface CompanySummary {
  id: string;
  code: string;
  name: string;
  logoBase64?: string;
  address?: string;
  status: 'active' | 'suspended' | 'archived';
}

export interface CreateCompanyInput {
  code: string;
  name: string;
  address: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export const getCompanies = () => apiGet<CompanySummary[]>('/api/platform/companies');
export const createCompany = (input: CreateCompanyInput) => apiPost<CompanySummary>('/api/platform/companies', input);
export const switchToCompany = (id: string) => apiPost<{ token: string; company: Omit<CompanySummary, 'status'> }>(`/api/platform/companies/${id}/switch`, {});
export const exitCompany = () => apiPost<{ token: string }>('/api/platform/companies/exit', {});
export const updateCompanyStatus = (id: string, status: CompanySummary['status']) =>
  apiPut<{ id: string; status: CompanySummary['status'] }>(`/api/platform/companies/${id}/status`, { status });
