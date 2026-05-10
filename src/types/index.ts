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

export interface RestrictedNumber {
  number: string;
  limit: number; // max amount that can be bet on this number platform-wide
}

export interface Draw {
  id: string;
  name: string;
  openTime: string;   // ISO datetime
  closeTime: string;  // ISO datetime
  winnerNumber?: string;
  status: DrawStatus;
  restrictedNumbers: RestrictedNumber[];
  createdAt: string;
}

// ─── Tickets & Sales ─────────────────────────────────────────────────────────

export interface TicketLine {
  number: string;
  amount: number;
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
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface SalesStat {
  associateId: string;
  drawId: string;
  totalSales: number;
  ticketCount: number;
  topNumbers: { number: string; total: number }[];
}
