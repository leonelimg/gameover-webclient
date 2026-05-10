import axios, { AxiosInstance, AxiosError } from 'axios';
import { User, Plan, Draw, Ticket } from '@/types';

// ─── Base URL ─────────────────────────────────────────────────────────────────
// When VITE_API_URL is set, use the real API. Otherwise fall back to localhost.
const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:4000';

// ─── Axios instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token storage ────────────────────────────────────────────────────────────

export const tokenStorage = {
  getAccess: (): string | null => localStorage.getItem('go_access_token'),
  getRefresh: (): string | null => localStorage.getItem('go_refresh_token'),
  set: (access: string, refresh: string) => {
    localStorage.setItem('go_access_token', access);
    localStorage.setItem('go_refresh_token', refresh);
  },
  clear: () => {
    localStorage.removeItem('go_access_token');
    localStorage.removeItem('go_refresh_token');
    localStorage.removeItem('go_session');
  },
};

// ─── Request interceptor — attach access token ────────────────────────────────

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — auto-refresh access token ────────────────────────

let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        tokenStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post<{ accessToken: string; refreshToken: string }>(
              `${BASE_URL}/api/auth/refresh`,
              { refreshToken }
            )
            .then((r) => {
              const { accessToken, refreshToken: newRefresh } = r.data;
              tokenStorage.set(accessToken, newRefresh);
              return accessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const newAccess = await refreshPromise;
        if (original.headers) {
          original.headers.Authorization = `Bearer ${newAccess}`;
        }
        return api(original);
      } catch {
        tokenStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>('/api/auth/login', { username, password });
    return res.data;
  },
  logout: async () => {
    await api.post('/api/auth/logout');
    tokenStorage.clear();
  },
  me: async (): Promise<User> => {
    const res = await api.get<User>('/api/auth/me');
    return res.data;
  },
};

// ─── Users API ────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  password: string;
  planId?: string;
  parentId?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  planId?: string | null;
  parentId?: string | null;
}

export const usersApi = {
  list: async (params?: { role?: string; status?: string; search?: string }): Promise<User[]> => {
    const res = await api.get<User[]>('/api/users', { params });
    return res.data;
  },
  get: async (id: string): Promise<User> => {
    const res = await api.get<User>(`/api/users/${id}`);
    return res.data;
  },
  create: async (data: CreateUserPayload): Promise<User> => {
    const res = await api.post<User>('/api/users', data);
    return res.data;
  },
  update: async (id: string, data: UpdateUserPayload): Promise<User> => {
    const res = await api.patch<User>(`/api/users/${id}`, data);
    return res.data;
  },
  changePassword: async (id: string, password: string): Promise<void> => {
    await api.patch(`/api/users/${id}/password`, { password });
  },
  changeStatus: async (id: string, status: string): Promise<User> => {
    const res = await api.patch<User>(`/api/users/${id}/status`, { status });
    return res.data;
  },
};

// ─── Plans API ────────────────────────────────────────────────────────────────

export interface PlanPayload {
  name: string;
  multiplier: number;
  commission: number;
  masterId?: string | null;
}

export const plansApi = {
  list: async (): Promise<Plan[]> => {
    const res = await api.get<Plan[]>('/api/plans');
    return res.data;
  },
  get: async (id: string): Promise<Plan> => {
    const res = await api.get<Plan>(`/api/plans/${id}`);
    return res.data;
  },
  create: async (data: PlanPayload): Promise<Plan> => {
    const res = await api.post<Plan>('/api/plans', data);
    return res.data;
  },
  update: async (id: string, data: Partial<PlanPayload>): Promise<Plan> => {
    const res = await api.patch<Plan>(`/api/plans/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/plans/${id}`);
  },
};

// ─── Draws API ────────────────────────────────────────────────────────────────

export interface DrawPayload {
  name: string;
  openTime: string;
  closeTime: string;
  winnerNumber?: string | null;
}

export const drawsApi = {
  list: async (): Promise<Draw[]> => {
    const res = await api.get<Draw[]>('/api/draws');
    return res.data;
  },
  get: async (id: string): Promise<Draw> => {
    const res = await api.get<Draw>(`/api/draws/${id}`);
    return res.data;
  },
  create: async (data: DrawPayload): Promise<Draw> => {
    const res = await api.post<Draw>('/api/draws', data);
    return res.data;
  },
  update: async (id: string, data: Partial<DrawPayload>): Promise<Draw> => {
    const res = await api.patch<Draw>(`/api/draws/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/draws/${id}`);
  },
  addRestrictedNumber: async (drawId: string, number: string, limit: number) => {
    const res = await api.post(`/api/draws/${drawId}/restricted-numbers`, { number, limit });
    return res.data;
  },
  removeRestrictedNumber: async (drawId: string, number: string) => {
    await api.delete(`/api/draws/${drawId}/restricted-numbers/${encodeURIComponent(number)}`);
  },
};

// ─── Tickets API ──────────────────────────────────────────────────────────────

export interface CreateTicketPayload {
  drawId: string;
  customerName: string;
  lines: { number: string; amount: number; isNicaEspecial: boolean }[];
}

export const ticketsApi = {
  list: async (params?: { drawId?: string; sellerId?: string }): Promise<Ticket[]> => {
    const res = await api.get<Ticket[]>('/api/tickets', { params });
    return res.data;
  },
  get: async (id: string): Promise<Ticket> => {
    const res = await api.get<Ticket>(`/api/tickets/${id}`);
    return res.data;
  },
  create: async (data: CreateTicketPayload): Promise<Ticket> => {
    const res = await api.post<Ticket>('/api/tickets', data);
    return res.data;
  },
  markPrinted: async (id: string): Promise<Ticket> => {
    const res = await api.patch<Ticket>(`/api/tickets/${id}/print`);
    return res.data;
  },
};

// ─── Reports API ──────────────────────────────────────────────────────────────

export interface ReportSummary {
  ticketCount: number;
  totalSales: number;
  userCount: number;
  drawCount: number;
}

export interface TopNumber {
  number: string;
  total: number;
}

export interface HierarchyNode {
  user: Partial<User>;
  totalSales: number;
  ticketCount: number;
  children: HierarchyNode[];
}

export const reportsApi = {
  summary: async (drawId?: string): Promise<ReportSummary> => {
    const res = await api.get<ReportSummary>('/api/reports/summary', { params: { drawId } });
    return res.data;
  },
  topNumbers: async (drawId?: string, limit = 10): Promise<TopNumber[]> => {
    const res = await api.get<TopNumber[]>('/api/reports/top-numbers', { params: { drawId, limit } });
    return res.data;
  },
  hierarchy: async (drawId?: string): Promise<HierarchyNode[]> => {
    const res = await api.get<HierarchyNode[]>('/api/reports/hierarchy', { params: { drawId } });
    return res.data;
  },
  recentTickets: async (drawId?: string, limit = 10): Promise<Ticket[]> => {
    const res = await api.get<Ticket[]>('/api/reports/recent-tickets', { params: { drawId, limit } });
    return res.data;
  },
};

export default api;
