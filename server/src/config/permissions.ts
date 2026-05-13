export type AppRole = 'admin' | 'asociado' | 'vendedor';

export interface AppResource {
  key: string;
  label: string;
}

export const APP_RESOURCES: AppResource[] = [
  { key: '/dashboard', label: 'Dashboard' },
  { key: '/users', label: 'Usuarios' },
  { key: '/roles', label: 'Roles' },
  { key: '/plans', label: 'Planes' },
  { key: '/draws', label: 'Sorteos' },
  { key: '/multiplicadores', label: 'Multiplicadores especiales' },
  { key: '/sales', label: 'Ventas' },
  { key: '/ticket-payments', label: 'Pago de tickets' },
  { key: '/cash-movements', label: 'Depositos y retiros' },
  { key: '/print-queue', label: 'Cola de impresion' },
  { key: '/reports', label: 'Reportes' },
  { key: '/reports/sales-stats', label: 'Reporte: Estadistica de ventas' },
  { key: '/reports/balance-breakdown', label: 'Reporte: Desglose de balance' },
  { key: '/reports/sales-by-user', label: 'Reporte: Ventas por usuario' },
  { key: '/reports/draw-lists', label: 'Reporte: Listas de sorteos' },
];

export const APP_RESOURCE_KEYS = new Set(APP_RESOURCES.map((resource) => resource.key));

const DEFAULT_RESOURCE_ACCESS: Record<string, AppRole[]> = {
  '/dashboard': ['admin', 'asociado', 'vendedor'],
  '/users': ['admin', 'asociado'],
  '/roles': ['admin'],
  '/plans': ['admin', 'asociado'],
  '/draws': ['admin', 'asociado'],
  '/multiplicadores': ['admin'],
  '/sales': ['admin', 'asociado', 'vendedor'],
  '/ticket-payments': ['admin', 'asociado', 'vendedor'],
  '/cash-movements': ['admin', 'asociado', 'vendedor'],
  '/print-queue': ['admin', 'asociado', 'vendedor'],
  '/reports': ['admin', 'asociado'],
  '/reports/sales-stats': ['admin', 'asociado'],
  '/reports/balance-breakdown': ['admin', 'asociado'],
  '/reports/sales-by-user': ['admin', 'asociado'],
  '/reports/draw-lists': ['admin', 'asociado'],
};

export function isDefaultAllowed(resourceKey: string, role: AppRole): boolean {
  return DEFAULT_RESOURCE_ACCESS[resourceKey]?.includes(role) ?? false;
}

export function getDefaultPermissionsRow(resourceKey: string): {
  admin: boolean;
  asociado: boolean;
  vendedor: boolean;
} {
  return {
    admin: isDefaultAllowed(resourceKey, 'admin'),
    asociado: isDefaultAllowed(resourceKey, 'asociado'),
    vendedor: isDefaultAllowed(resourceKey, 'vendedor'),
  };
}
