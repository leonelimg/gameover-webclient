import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck } from 'lucide-react';

interface Permission {
  label: string;
  admin: boolean;
  asociado: boolean;
  vendedor: boolean;
}

const PERMISSIONS: Permission[] = [
  { label: 'Gestión de usuarios', admin: true, asociado: false, vendedor: false },
  { label: 'Editar usuarios', admin: true, asociado: true, vendedor: false },
  { label: 'Bloquear/desbloquear usuarios', admin: true, asociado: false, vendedor: false },
  { label: 'Gestión de roles', admin: true, asociado: false, vendedor: false },
  { label: 'Gestión de planes', admin: true, asociado: true, vendedor: false },
  { label: 'Crear/editar sorteos', admin: true, asociado: false, vendedor: false },
  { label: 'Ver sorteos', admin: true, asociado: true, vendedor: false },
  { label: 'Realizar ventas', admin: true, asociado: true, vendedor: true },
  { label: 'Ver estadísticas de ventas', admin: true, asociado: true, vendedor: false },
  { label: 'Reportes jerárquicos', admin: true, asociado: true, vendedor: false },
  { label: 'Administración total', admin: true, asociado: false, vendedor: false },
  { label: 'Gestión de números restringidos', admin: true, asociado: false, vendedor: false },
];

const roles = [
  {
    key: 'admin',
    label: 'Administrador',
    color: 'info' as const,
    description:
      'Acceso completo al sistema. Puede gestionar usuarios, roles, planes, sorteos, ventas y reportes.',
  },
  {
    key: 'asociado',
    label: 'Asociado',
    color: 'secondary' as const,
    description:
      'Puede gestionar sus propios vendedores, planes asignados, ver reportes de su jerarquía y realizar ventas.',
  },
  {
    key: 'vendedor',
    label: 'Vendedor',
    color: 'warning' as const,
    description:
      'Acceso exclusivo al módulo de ventas. No puede tener asociados hijos ni acceder a reportes.',
  },
];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles y Permisos</h1>
        <p className="text-sm text-slate-500">Definición de roles y sus permisos en el sistema</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((r) => (
          <Card key={r.key}>
            <CardBody>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={20} className="text-blue-600" />
                </div>
                <div>
                  <Badge variant={r.color}>{r.label}</Badge>
                </div>
              </div>
              <p className="text-sm text-slate-600">{r.description}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Permissions matrix */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-800">Matriz de Permisos</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Permiso</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Admin</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Asociado</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.label} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{p.label}</td>
                  <td className="px-4 py-3 text-center">
                    {p.admin ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.asociado ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.vendedor ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
