import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  User,
  Plan,
  Draw,
  Ticket,
  Announcement,
  AnnouncementPayload,
  GlobalNumberRestrictionSettings,
  RolePermissionRow,
  PaymentsWinningTicketsResponse,
  SpecialMultiplier,
} from '@/types';

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

const notifyUnauthorized = () => {
  window.dispatchEvent(new Event('go:unauthorized'));
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        tokenStorage.clear();
        notifyUnauthorized();
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
        notifyUnauthorized();
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

// ─── Roles API ───────────────────────────────────────────────────────────────

export const rolesApi = {
  myPermissions: async (): Promise<string[]> => {
    const res = await api.get<{ permissions: string[] }>('/api/roles/my-permissions');
    return res.data.permissions;
  },
  getPermissions: async (): Promise<RolePermissionRow[]> => {
    const res = await api.get<{ permissions: RolePermissionRow[] }>('/api/roles/permissions');
    return res.data.permissions;
  },
  updatePermissions: async (
    permissions: Array<Pick<RolePermissionRow, 'resourceKey' | 'asociado' | 'vendedor'>>
  ): Promise<RolePermissionRow[]> => {
    const res = await api.patch<{ permissions: RolePermissionRow[] }>('/api/roles/permissions', {
      permissions,
    });
    return res.data.permissions;
  },
};

// ─── Global Number Restrictions API ─────────────────────────────────────────

export const numberRestrictionsApi = {
  getGlobal: async (): Promise<GlobalNumberRestrictionSettings> => {
    const res = await api.get<GlobalNumberRestrictionSettings>('/api/number-restrictions/global');
    return res.data;
  },
  updateGlobal: async (globalLimit: number | null): Promise<GlobalNumberRestrictionSettings> => {
    const res = await api.patch<GlobalNumberRestrictionSettings>('/api/number-restrictions/global', {
      globalLimit,
    });
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
  closeTime: string;
  minutosPreviosCierre: number;
  winnerNumber?: string | null;
  specialMultiplierId?: string | null;
}

export interface DrawListPagedParams {
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface DrawListPagedResponse {
  items: Draw[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const drawsApi = {
  list: async (): Promise<Draw[]> => {
    const res = await api.get<Draw[]>('/api/draws');
    return res.data;
  },
  listPaged: async (params?: DrawListPagedParams): Promise<DrawListPagedResponse> => {
    const res = await api.get<DrawListPagedResponse>('/api/draws/search', { params });
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
  list: async (params?: {
    drawId?: string;
    sellerId?: string;
    associateId?: string;
    code?: string;
    includeCanceled?: boolean;
  }): Promise<Ticket[]> => {
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
  cancel: async (id: string, reason?: string): Promise<Ticket> => {
    const res = await api.patch<Ticket>(`/api/tickets/${id}/cancel`, { reason });
    return res.data;
  },
};

// ─── Cash Movements API ──────────────────────────────────────────────────────

export type CashMovementType = 'deposito' | 'retiro';
export type CashMovementHistoryType = CashMovementType | 'venta';

export interface CashMovementActor {
  id: string;
  fullName: string;
  username: string;
  role: 'admin' | 'asociado' | 'vendedor';
}

export interface CashMovementUserSummary {
  id: string;
  fullName: string;
  username: string;
  role: 'asociado' | 'vendedor';
  status: 'activo' | 'bloqueado' | 'archivado';
  canOperate: boolean;
}

export interface CashMovement {
  id: string;
  targetUserId: string;
  createdById: string;
  type: CashMovementType;
  amount: number;
  note?: string | null;
  createdAt: string;
  canceledAt?: string | null;
  canceledById?: string | null;
  createdBy: CashMovementActor;
  targetUser: CashMovementActor;
}

export interface CashMovementHistoryItem {
  id: string;
  targetUserId: string;
  createdById: string;
  type: CashMovementHistoryType;
  amount: number;
  note?: string | null;
  createdAt: string;
  canceledAt?: string | null;
  canceledById?: string | null;
  createdBy: CashMovementActor;
  targetUser: CashMovementActor;
  source: 'cash-movement' | 'ticket-sale';
  referenceCode?: string;
}

export interface CashMovementBalanceResponse {
  targetUser: {
    id: string;
    fullName: string;
    username: string;
    role: 'admin' | 'asociado' | 'vendedor';
    status: 'activo' | 'bloqueado' | 'archivado';
  };
  totals: {
    openingBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalSales: number;
    totalPrizes: number;
    ticketCount: number;
    balance: number;
  };
  filters: {
    fromDate: string | null;
    toDate: string | null;
  };
}

export interface CashMovementEventSummaryItem {
  eventId: string;
  eventName: string;
  eventDate: string;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
  balanceAfterTransaction: number;
}

export interface CashMovementEventSummaryResponse {
  targetUser: {
    id: string;
    fullName: string;
    username: string;
    role: 'admin' | 'asociado' | 'vendedor';
    status: 'activo' | 'bloqueado' | 'archivado';
  };
  totals: {
    openingBalance: number;
    ticketCount: number;
    totalSales: number;
    totalPrizes: number;
    totalCommissions: number;
    balance: number;
  };
  filters: {
    fromDate: string | null;
    toDate: string | null;
  };
  rows: CashMovementEventSummaryItem[];
}

export interface CreateCashMovementPayload {
  targetUserId: string;
  type: CashMovementType;
  amount: number;
  note?: string;
}

export const cashMovementsApi = {
  targets: async (): Promise<CashMovementUserSummary[]> => {
    const res = await api.get<CashMovementUserSummary[]>('/api/cash-movements/targets');
    return res.data;
  },
  list: async (params?: {
    targetUserId?: string;
    type?: CashMovementType;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<CashMovementHistoryItem[]> => {
    const res = await api.get<CashMovementHistoryItem[]>('/api/cash-movements', { params });
    return res.data;
  },
  balance: async (params?: {
    targetUserId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<CashMovementBalanceResponse> => {
    const res = await api.get<CashMovementBalanceResponse>('/api/cash-movements/balance', { params });
    return res.data;
  },
  summaryByEvent: async (params?: {
    targetUserId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<CashMovementEventSummaryResponse> => {
    const res = await api.get<CashMovementEventSummaryResponse>('/api/cash-movements/summary-by-event', {
      params,
    });
    return res.data;
  },
  create: async (payload: CreateCashMovementPayload): Promise<CashMovement> => {
    const res = await api.post<CashMovement>('/api/cash-movements', payload);
    return res.data;
  },
  cancel: async (id: string, reason?: string): Promise<CashMovement> => {
    const res = await api.patch<CashMovement>(`/api/cash-movements/${id}/cancel`, { reason });
    return res.data;
  },
};

// ─── Special Multipliers API ─────────────────────────────────────────────────

export interface SpecialMultiplierPayload {
  name: string;
  value: number;
}

export const specialMultipliersApi = {
  list: async (): Promise<SpecialMultiplier[]> => {
    const res = await api.get<SpecialMultiplier[]>('/api/special-multipliers');
    return res.data;
  },
  get: async (id: string): Promise<SpecialMultiplier> => {
    const res = await api.get<SpecialMultiplier>(`/api/special-multipliers/${id}`);
    return res.data;
  },
  create: async (payload: SpecialMultiplierPayload): Promise<SpecialMultiplier> => {
    const res = await api.post<SpecialMultiplier>('/api/special-multipliers', payload);
    return res.data;
  },
  update: async (id: string, payload: Partial<SpecialMultiplierPayload>): Promise<SpecialMultiplier> => {
    const res = await api.patch<SpecialMultiplier>(`/api/special-multipliers/${id}`, payload);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/special-multipliers/${id}`);
  },
};

// ─── Payments API ────────────────────────────────────────────────────────────

export interface ListWinningTicketsParams {
  drawId: string;
  status?: 'all' | 'pendiente' | 'pagado';
  code?: string;
}

export interface MarkPaidPayload {
  ticketId?: string;
  code?: string;
}

export interface MarkPaidResponse {
  ticket: Ticket;
  prizeAmount: number;
}

export const paymentsApi = {
  listWinningTickets: async (params: ListWinningTicketsParams): Promise<PaymentsWinningTicketsResponse> => {
    const res = await api.get<PaymentsWinningTicketsResponse>('/api/payments/winning-tickets', { params });
    return res.data;
  },
  markPaid: async (payload: MarkPaidPayload): Promise<MarkPaidResponse> => {
    const res = await api.patch<MarkPaidResponse>('/api/payments/mark-paid', payload);
    return res.data;
  },
  revertPayment: async (ticketId: string): Promise<Ticket> => {
    const res = await api.patch<Ticket>(`/api/payments/${ticketId}/revert`);
    return res.data;
  },
};

// ─── Announcements API ───────────────────────────────────────────────────────

const toAnnouncementFormData = (payload: AnnouncementPayload): FormData => {
  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('startDate', payload.startDate);
  formData.append('endDate', payload.endDate);

  if (payload.message !== undefined) {
    formData.append('message', payload.message);
  }
  if (payload.image) {
    formData.append('image', payload.image);
  }
  if (payload.clearImage !== undefined) {
    formData.append('clearImage', String(payload.clearImage));
  }

  return formData;
};

export const announcementsApi = {
  active: async (): Promise<Announcement[]> => {
    const res = await api.get<Announcement[]>('/api/announcements/active');
    return res.data;
  },
  list: async (): Promise<Announcement[]> => {
    const res = await api.get<Announcement[]>('/api/announcements');
    return res.data;
  },
  create: async (payload: AnnouncementPayload): Promise<Announcement> => {
    const res = await api.post<Announcement>('/api/announcements', toAnnouncementFormData(payload), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  update: async (id: string, payload: AnnouncementPayload): Promise<Announcement> => {
    const res = await api.patch<Announcement>(`/api/announcements/${id}`, toAnnouncementFormData(payload), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/announcements/${id}`);
  },
  dismiss: async (id: string): Promise<void> => {
    await api.post(`/api/announcements/${id}/dismiss`);
  },
};

// ─── Reports API ──────────────────────────────────────────────────────────────

export interface ReportSummary {
  ticketCount: number;
  totalSales: number;
  userCount: number;
  drawCount: number;
  totalPrizes: number;
  totalCommissions: number;
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

export interface BalanceBreakdownRow {
  userId: string;
  fullName: string;
  username: string;
  role: 'admin' | 'asociado' | 'vendedor';
  parentName: string | null;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
}

export interface VendorBreakdownRow {
  vendorId: string;
  vendorName: string;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
}

export interface DrawBreakdownRow {
  drawId: string;
  drawName: string;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
}

export interface AssociateDrawBreakdownRow {
  drawId: string;
  drawName: string;
  drawCloseTime?: string;
  lastTicketCreatedAt?: string;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
}

export interface AssociateBreakdownRow {
  associateId: string;
  associateName: string;
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
  draws: AssociateDrawBreakdownRow[];
}

export interface BalanceBreakdownTotals {
  ticketCount: number;
  totalSales: number;
  totalPrizes: number;
  totalCommissions: number;
  balance: number;
}

export interface BalanceBreakdownResponse {
  filters: {
    drawId: string | null;
    userId?: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  totals: BalanceBreakdownTotals;
  rows: BalanceBreakdownRow[];
  byVendor: {
    totals: BalanceBreakdownTotals;
    rows: VendorBreakdownRow[];
  };
  byDraw: {
    totals: BalanceBreakdownTotals;
    rows: DrawBreakdownRow[];
  };
  byAssociate: {
    totals: BalanceBreakdownTotals;
    rows: AssociateBreakdownRow[];
  };
}

export interface SalesByUserRow {
  userId: string;
  fullName: string;
  username: string;
  role: 'admin' | 'asociado' | 'vendedor';
  ticketCount: number;
  activeTicketCount: number;
  canceledTicketCount: number;
  totalSales: number;
}

export interface SalesByUserResponse {
  filters: {
    drawId: string | null;
    userId: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  totals: {
    ticketCount: number;
    activeTicketCount: number;
    canceledTicketCount: number;
    totalSales: number;
  };
  rows: SalesByUserRow[];
  tickets: Ticket[];
}

export interface DrawListNumberRow {
  number: string;
  total: number;
}

export interface DrawListsResponse {
  filters: {
    drawId: string | null;
    userId: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  totals: {
    ticketCount: number;
    totalAmount: number;
  };
  numbers: DrawListNumberRow[];
}

export interface CommissionsReportRow {
  drawId?: string;
  drawName: string;
  drawCloseTime: string;
  totalSales: number;
  commission: number;
}

export interface CommissionsSellerGroup {
  sellerId: string;
  sellerName: string;
  sellerUsername: string;
  totalSales: number;
  subtotal: number;
  rows: CommissionsReportRow[];
}

export interface CommissionsReportResponse {
  filters: {
    drawId: string | null;
    userId: string | null;
    fromDate: string | null;
    toDate: string | null;
  };
  totals: {
    totalSales: number;
    totalCommissions: number;
  };
  bySeller: CommissionsSellerGroup[];
}

export const reportsApi = {
  summary: async (drawId?: string, fromDate?: string, toDate?: string): Promise<ReportSummary> => {
    const res = await api.get<ReportSummary>('/api/reports/summary', { params: { drawId, fromDate, toDate } });
    return res.data;
  },
  topNumbers: async (drawId?: string, limit = 10, fromDate?: string, toDate?: string): Promise<TopNumber[]> => {
    const res = await api.get<TopNumber[]>('/api/reports/top-numbers', { params: { drawId, limit, fromDate, toDate } });
    return res.data;
  },
  hierarchy: async (drawId?: string, fromDate?: string, toDate?: string): Promise<HierarchyNode[]> => {
    const res = await api.get<HierarchyNode[]>('/api/reports/hierarchy', { params: { drawId, fromDate, toDate } });
    return res.data;
  },
  recentTickets: async (drawId?: string, limit = 10, fromDate?: string, toDate?: string): Promise<Ticket[]> => {
    const res = await api.get<Ticket[]>('/api/reports/recent-tickets', { params: { drawId, limit, fromDate, toDate } });
    return res.data;
  },
  balanceBreakdown: async (params?: {
    drawId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<BalanceBreakdownResponse> => {
    const res = await api.get<BalanceBreakdownResponse>('/api/reports/balance-breakdown', { params });
    return res.data;
  },
  salesByUser: async (params?: {
    drawId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<SalesByUserResponse> => {
    const res = await api.get<SalesByUserResponse>('/api/reports/sales-by-user', { params });
    return res.data;
  },
  drawLists: async (params?: {
    drawId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<DrawListsResponse> => {
    const res = await api.get<DrawListsResponse>('/api/reports/draw-lists', { params });
    return res.data;
  },
  commissions: async (params?: {
    drawId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<CommissionsReportResponse> => {
    const res = await api.get<CommissionsReportResponse>('/api/reports/commissions', { params });
    return res.data;
  },
};

export interface PrintBridgeInstallerInfo {
  fileName: string;
  sizeBytes: number;
  updatedAt: string;
  downloadUrl: string;
}

const parseDownloadFilename = (contentDisposition?: string): string => {
  if (!contentDisposition) return 'gameover-print-bridge-installer.exe';

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return 'gameover-print-bridge-installer.exe';
};

export const printBridgeInstallerApi = {
  getInfo: async (): Promise<PrintBridgeInstallerInfo> => {
    const res = await api.get<PrintBridgeInstallerInfo>('/api/print-bridge/installer');
    return res.data;
  },

  download: async (downloadUrl?: string, preferredFileName?: string): Promise<{ blob: Blob; fileName: string }> => {
    const res = await api.get<Blob>(downloadUrl ?? '/api/print-bridge/installer/download', {
      responseType: 'blob',
    });

    const fileName = preferredFileName ?? parseDownloadFilename(res.headers['content-disposition']);
    const result = {
      blob: res.data,
      fileName,
    };

    const downloadHref = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = downloadHref;
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadHref);

    return result;
  },
};

export default api;
