export type AppRole = 'admin' | 'asociado' | 'vendedor';

export interface AppResource {
  key: string;
  label: string;
}

export const APP_RESOURCES: AppResource[] = [
  { key: '/dashboard', label: 'Dashboard' },
  { key: '/users', label: 'Usuarios' },
  { key: '/users:create', label: 'Usuarios: crear' },
  { key: '/users:update', label: 'Usuarios: editar' },
  { key: '/users:status', label: 'Usuarios: bloquear / archivar' },
  { key: '/users:password', label: 'Usuarios: cambiar contrasena' },
  { key: '/roles', label: 'Roles' },
  { key: '/roles:update', label: 'Roles: editar permisos' },
  { key: '/plans', label: 'Planes' },
  { key: '/plans:create', label: 'Planes: crear' },
  { key: '/plans:update', label: 'Planes: editar' },
  { key: '/plans:delete', label: 'Planes: eliminar' },
  { key: '/draws', label: 'Sorteos' },
  { key: '/draws:create', label: 'Sorteos: crear' },
  { key: '/draws:update', label: 'Sorteos: editar' },
  { key: '/draws:delete', label: 'Sorteos: eliminar' },
  { key: '/draws:restricted-numbers', label: 'Sorteos: gestionar restringidos' },
  { key: '/draws/list', label: 'Listas operativas de sorteos' },
  { key: '/number-restrictions', label: 'Restriccion global de numeros' },
  { key: '/restrictions', label: 'Restricciones' },
  { key: '/restrictions/global', label: 'Restricciones: global' },
  { key: '/restrictions/user-global', label: 'Restricciones: global por usuario' },
  { key: '/restrictions/user-sales-limit', label: 'Restricciones: venta por usuario' },
  { key: '/restrictions:update-global', label: 'Restricciones: actualizar global' },
  { key: '/restrictions:update-user-global', label: 'Restricciones: actualizar global por usuario' },
  { key: '/restrictions:update-user-sales-limit', label: 'Restricciones: actualizar venta por usuario' },
  { key: '/multiplicadores', label: 'Multiplicadores especiales' },
  { key: '/multiplicadores:create', label: 'Multiplicadores: crear' },
  { key: '/multiplicadores:update', label: 'Multiplicadores: editar' },
  { key: '/multiplicadores:delete', label: 'Multiplicadores: eliminar' },
  { key: '/sales', label: 'Ventas' },
  { key: '/sales:create', label: 'Ventas: registrar ticket' },
  { key: '/sales:cancel', label: 'Ventas: anular tickets' },
  { key: '/ticket-payments', label: 'Pago de tickets' },
  { key: '/ticket-payments:mark-paid', label: 'Pago de tickets: pagar' },
  { key: '/ticket-payments:revert', label: 'Pago de tickets: revertir pago' },
  { key: '/cash-movements', label: 'Depositos y retiros' },
  { key: '/cash-movements:create', label: 'Depositos y retiros: registrar movimientos' },
  { key: '/cash-movements:cancel', label: 'Depositos y retiros: cancelar movimientos' },
  { key: '/print-queue', label: 'Cola de impresion' },
  { key: '/reports', label: 'Reportes' },
  { key: '/reports/sales-stats', label: 'Reporte: Estadistica de ventas' },
  { key: '/reports/balance-breakdown', label: 'Reporte: Desglose de balance' },
  { key: '/reports/sales-by-user', label: 'Reporte: Ventas por usuario' },
  { key: '/reports/draw-lists', label: 'Reporte: Listas de sorteos' },
  { key: '/reports/commissions', label: 'Reporte: Comisiones' },
  { key: '/announcements', label: 'Anuncios' },
  { key: '/announcements:create', label: 'Anuncios: crear' },
  { key: '/announcements:update', label: 'Anuncios: editar' },
  { key: '/announcements:delete', label: 'Anuncios: eliminar' },
];

export const APP_RESOURCE_KEYS = new Set(APP_RESOURCES.map((resource) => resource.key));

const DEFAULT_RESOURCE_ACCESS: Record<string, AppRole[]> = {
  '/dashboard': ['admin', 'asociado', 'vendedor'],
  '/users': ['admin', 'asociado'],
  '/users:create': ['admin', 'asociado'],
  '/users:update': ['admin', 'asociado'],
  '/users:status': ['admin'],
  '/users:password': ['admin'],
  '/roles': ['admin'],
  '/roles:update': ['admin'],
  '/plans': ['admin', 'asociado'],
  '/plans:create': ['admin'],
  '/plans:update': ['admin'],
  '/plans:delete': ['admin'],
  '/draws': ['admin', 'asociado'],
  '/draws:create': ['admin'],
  '/draws:update': ['admin'],
  '/draws:delete': ['admin'],
  '/draws:restricted-numbers': ['admin'],
  '/draws/list': ['admin', 'asociado', 'vendedor'],
  '/number-restrictions': ['admin', 'asociado'],
  '/restrictions': ['admin', 'asociado'],
  '/restrictions/global': ['admin', 'asociado'],
  '/restrictions/user-global': ['admin', 'asociado'],
  '/restrictions/user-sales-limit': ['admin', 'asociado'],
  '/restrictions:update-global': ['admin', 'asociado'],
  '/restrictions:update-user-global': ['admin', 'asociado'],
  '/restrictions:update-user-sales-limit': ['admin', 'asociado'],
  '/multiplicadores': ['admin'],
  '/multiplicadores:create': ['admin'],
  '/multiplicadores:update': ['admin'],
  '/multiplicadores:delete': ['admin'],
  '/sales': ['admin', 'asociado', 'vendedor'],
  '/sales:create': ['admin', 'asociado', 'vendedor'],
  '/sales:cancel': ['admin', 'asociado'],
  '/ticket-payments': ['admin', 'asociado', 'vendedor'],
  '/ticket-payments:mark-paid': ['admin', 'asociado', 'vendedor'],
  '/ticket-payments:revert': ['admin', 'asociado', 'vendedor'],
  '/cash-movements': ['admin', 'asociado', 'vendedor'],
  '/cash-movements:create': ['admin', 'asociado'],
  '/cash-movements:cancel': ['admin', 'asociado', 'vendedor'],
  '/print-queue': ['admin', 'asociado', 'vendedor'],
  '/reports': ['admin', 'asociado'],
  '/reports/sales-stats': ['admin', 'asociado'],
  '/reports/balance-breakdown': ['admin', 'asociado'],
  '/reports/sales-by-user': ['admin', 'asociado'],
  '/reports/draw-lists': ['admin', 'asociado'],
  '/reports/commissions': ['admin', 'asociado'],
  '/announcements': ['admin'],
  '/announcements:create': ['admin'],
  '/announcements:update': ['admin'],
  '/announcements:delete': ['admin'],
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
