import { CashMovementHistoryItem } from '@/services/api';

/**
 * Generates a unique 7-digit numeric code from a CUID.
 */
export function getNumericId(cuid: string): string {
  if (!cuid) return '0000000';
  let hash = 0;
  for (let i = 0; i < cuid.length; i++) {
    hash = cuid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash);
  return String(positiveHash % 10000000).padStart(7, '0');
}

/**
 * Generates a unique 4-digit numeric code for a user and prepends it to their name.
 * Example: "2419-Marvin"
 */
export function formatUserLabel(user: { id: string; fullName: string }): string {
  if (!user) return '-';
  let hash = 0;
  const key = user.id || user.fullName || '';
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const code = (Math.abs(hash) % 9000) + 1000;
  return `${code}-${user.fullName}`;
}

/**
 * Formats a date into YYYY-MM-DD HH:mm:ss.
 */
export function formatDateTimeForTicket(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const BOLD_ON = '\x1b\x45\x01';
const BOLD_OFF = '\x1b\x45\x00';

/**
 * Formats a Cash Movement row into a thermal printer friendly receipt string.
 */
export function formatMovementTicketText(row: CashMovementHistoryItem): string {
  const ticketId = getNumericId(row.id);
  const dateStr = formatDateTimeForTicket(row.createdAt);
  const promotorLabel = formatUserLabel(row.createdBy);
  const clienteLabel = formatUserLabel(row.targetUser);
  const typeLabel = row.type === 'deposito' ? 'Depósito a usuario' : 'Retiro de usuario';
  const noteLabel = row.note ? row.note.trim() : '-';

  // Amount formatting (with commas for thousands, e.g., 2,601.00)
  const amountStr = Number(Math.abs(row.amount)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return [
    '          COMPROBANTE\n',
    `Tiquete: ${BOLD_ON}${ticketId}${BOLD_OFF}`,
    dateStr,
    '',
    'Promotor:',
    promotorLabel,
    '',
    'Cliente:',
    clienteLabel,
    '',
    'Monto:',
    `${BOLD_ON}${amountStr}${BOLD_OFF}`,
    '',
    'Descripción:',
    `${BOLD_ON}${noteLabel}${BOLD_OFF}`,
    '',
    'Transaccion a saldo:',
    'General',
    '',
    'Tipo de transaccion:',
    `${BOLD_ON}${typeLabel}${BOLD_OFF}`,
    '',
    `Identificador: ${BOLD_ON}${ticketId}${BOLD_OFF}`,
  ].join('\n');
}
