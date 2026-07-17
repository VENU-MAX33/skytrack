const BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? '';

export const TOKEN_KEY = 'employee_jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch (error) {
    if ((error as Error).name === 'AbortError') throw new ApiError(408, 'Request timed out. Please try again.');
    throw new ApiError(0, navigator.onLine ? 'Could not reach the server.' : 'You appear to be offline.');
  } finally { clearTimeout(timer); }
}

async function handle<T>(res: Response, method: string, path: string): Promise<T> {
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('employee_user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  if (!res.ok) {
    let message = `${method} ${path} failed: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON error body; keep default message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!BASE_URL) throw new Error(`No BASE_URL configured for GET ${path}`);
  const res = await request(`${BASE_URL}${path}`, { headers: authHeaders() });
  return handle<T>(res, 'GET', path);
}

export async function apiPost<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  if (!BASE_URL) throw new Error(`No BASE_URL configured for POST ${path}`);
  const res = await request(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...extraHeaders },
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res, 'POST', path);
}
