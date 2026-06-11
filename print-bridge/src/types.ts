export type JobStatus = "pending" | "processing" | "retrying" | "completed" | "failed";

export interface TicketLineItem {
  label: string;
  qty?: number;
  unitPrice?: number;
  total?: number;
}

export interface TicketTotals {
  subtotal?: number;
  discount?: number;
  total: number;
  paid?: number;
  change?: number;
}

export interface TicketDetailLine {
  number: string;
  regular: number;
  special: number;
  total: number;
}

export interface TicketMultipliers {
  regular?: number;
  special?: number;
}

export interface TicketPayload {
  width?: 58 | 80;
  title?: string;
  businessName?: string;
  businessTaxId?: string;
  drawLabel?: string;
  customerName?: string;
  sellerName?: string;
  showSpecialColumn?: boolean;
  terminal?: string;
  cashier?: string;
  ticketNumber?: string;
  dateIso?: string;
  items: TicketLineItem[];
  detailLines?: TicketDetailLine[];
  multipliers?: TicketMultipliers;
  totals: TicketTotals;
  notes?: string[];
  qrText?: string;
  footer?: string[];
}

export interface PrintJob {
  id: string;
  type: "text" | "ticket";
  payload: {
    text?: string;
    ticket?: TicketPayload;
  };
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface QueueState {
  jobs: PrintJob[];
}

export interface PrinterInfo {
  transport: string;
  port?: string;
  baudRate?: number;
}

export interface JobResult {
  id: string;
  status: JobStatus;
  attempts: number;
  lastError?: string;
}
