// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'asociado' | 'vendedor';

export type UserStatus = 'activo' | 'bloqueado' | 'archivado';

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  planId?: string;
  parentId?: string; // parent associate id
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface RolePermissionRow {
  resourceKey: string;
  label: string;
  admin: boolean;
  asociado: boolean;
  vendedor: boolean;
}

export interface GlobalNumberRestrictionSettings {
  globalLimit: number | null;
}

export interface CurrentUserRestrictionSettings {
  userGlobalLimit: number | null;
  userDrawSaleLimit: number | null;
}

export interface UserRestrictionLimitItem {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  userGlobalLimit: number | null;
  userDrawSaleLimit: number | null;
}

export interface UserRestrictionLimitUpdateResult {
  userId: string;
  userGlobalLimit: number | null;
  userDrawSaleLimit: number | null;
}

export interface FrontendTicketSettings {
  ticketTitle: string;
  footerNote: string;
  ticketCodeFontSize: number;
  defaultTicketWidth: 58 | 80;
  sellerTicketWidths: Record<string, 58 | 80>;
}

export interface FrontendTicketVendorWidthRow {
  id: string;
  fullName: string;
  username: string;
  status: UserStatus;
  ticketWidth: 58 | 80;
}

export interface FrontendTicketVendorWidthsResponse {
  defaultTicketWidth: 58 | 80;
  sellers: FrontendTicketVendorWidthRow[];
}

// ─── Special Multipliers ─────────────────────────────────────────────────────

export interface SpecialMultiplier {
  id: string;
  name: string;
  value: number;       // integer 1-10
  createdAt: string;
  updatedAt: string;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  multiplier: number;       // prize multiplier
  commission: number;       // commission percentage 0-100
  masterId?: string;        // master associate id
  createdAt: string;
}

// ─── Draws (Sorteos) ─────────────────────────────────────────────────────────

export type DrawStatus = 'pendiente' | 'abierto' | 'cerrado' | 'finalizado';
export type TicketPaymentStatus = 'pendiente' | 'pagado';

export interface RestrictedNumber {
  number: string;
  limit: number; // max amount that can be bet on this number platform-wide
}

export interface Draw {
  id: string;
  name: string;
  closeTime: string;  // ISO datetime
  minutosPreviosCierre: number;
  winnerNumber?: string;
  status: DrawStatus;
  restrictedNumbers: RestrictedNumber[];
  specialMultiplier?: { id: string; name: string; value: number } | null;
  createdAt: string;
}

// ─── Tickets & Sales ─────────────────────────────────────────────────────────

export interface TicketLine {
  number: string;
  amount: number;
  specialAmount?: number | null;
  isNicaEspecial: boolean;
}

export interface Ticket {
  id: string;
  code: string;
  drawId: string;
  sellerId: string;
  associateId: string;
  customerName: string;
  lines: TicketLine[];
  total: number;
  createdAt: string;
  printedAt?: string;
  paymentStatus: TicketPaymentStatus;
  paidAt?: string;
  paidById?: string;
  canceledAt?: string;
  cancelReason?: string;
  draw?: {
    id: string;
    name: string;
    winnerNumber?: string | null;
    closeTime?: string;
    minutosPreviosCierre?: number;
    specialMultiplier?: {
      id: string;
      name: string;
      value: number;
    } | null;
  };
  seller?: {
    id: string;
    fullName: string;
    username: string;
    plan?: {
      id: string;
      name: string;
      multiplier: number;
    } | null;
  };
  associate?: {
    id: string;
    fullName: string;
  };
  canceledBy?: {
    id: string;
    fullName: string;
    username: string;
  };
  paidBy?: {
    id: string;
    fullName: string;
    username: string;
  };
}

export interface PaymentWinningTicket {
  ticketId: string;
  code: string;
  customerName: string;
  winningNumbers: string[];
  seller: {
    id: string;
    fullName: string;
    username: string;
  };
  createdAt: string;
  paymentStatus: TicketPaymentStatus;
  paidAt?: string | null;
  paidBy?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  prizeAmount: number;
}

export interface PaymentsWinningTicketsResponse {
  draw: {
    id: string;
    name: string;
    winnerNumber?: string | null;
    hasWinnerNumber: boolean;
  };
  tickets: PaymentWinningTicket[];
  paidTickets: PaymentWinningTicket[];
  totals: {
    totalToPay: number;
    totalPaid: number;
    totalPending: number;
    winnersCount: number;
    paidCount: number;
    pendingCount: number;
  };
}

// ─── Announcements ───────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  name: string;
  message?: string | null;
  imageUrl?: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: {
    id: string;
    fullName: string;
    username: string;
  };
}

export interface AnnouncementPayload {
  name: string;
  message?: string;
  startDate: string;
  endDate: string;
  image?: File;
  clearImage?: boolean;
}

// ─── Print Queue ─────────────────────────────────────────────────────────────

export type PrintJobStatus = 'pending' | 'processing' | 'retrying' | 'completed' | 'failed';

export interface PrintJob {
  id: string;
  type: 'text' | 'ticket';
  status: PrintJobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface PrintQueueStats {
  pending: number;
  processing: number;
  retrying: number;
  completed: number;
  failed: number;
  total: number;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface SalesStat {
  associateId: string;
  drawId: string;
  totalSales: number;
  ticketCount: number;
  topNumbers: { number: string; total: number }[];
}
