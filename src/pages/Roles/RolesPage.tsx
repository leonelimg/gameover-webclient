import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { rolesApi } from '@/services/api';
import { RolePermissionRow } from '@/types';

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
  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    rolesApi
      .getPermissions()
      .then((data) => {
        if (mounted) {
          setRows(data.map((row) => ({ ...row, admin: true })));
        }
      })
      .catch(() => {
        if (mounted) {
          setError('No se pudo cargar la matriz de permisos.');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggle = (resourceKey: string, role: 'asociado' | 'vendedor') => {
    setRows((current) =>
      current.map((row) =>
        row.resourceKey === resourceKey ? { ...row, [role]: !row[role] } : row
      )
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = rows.map((row) => ({
        resourceKey: row.resourceKey,
        asociado: row.asociado,
        vendedor: row.vendedor,
      }));
      const updated = await rolesApi.updatePermissions(payload);
      setRows(updated.map((row) => ({ ...row, admin: true })));
    } catch {
      setError('No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

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
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-800">Matriz de Permisos por Ruta</h2>
            <Button onClick={save} loading={saving} disabled={loading || saving || rows.length === 0}>
              Guardar cambios
            </Button>
          </div>
        </CardHeader>
        {error && <div className="px-4 pb-2 text-sm text-red-600">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Ruta/Recurso</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Admin</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Asociado</th>
                <th className="text-center px-4 py-3 text-slate-600 font-medium">Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    Cargando permisos...
                  </td>
                </tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.resourceKey} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-slate-500">{row.resourceKey}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold">✓</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(row.resourceKey, 'asociado')}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border ${
                        row.asociado
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-slate-100 border-slate-300 text-slate-400'
                      }`}
                      aria-label={`Alternar acceso asociado para ${row.resourceKey}`}
                    >
                      {row.asociado ? '✓' : '—'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(row.resourceKey, 'vendedor')}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full border ${
                        row.vendedor
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-slate-100 border-slate-300 text-slate-400'
                      }`}
                      aria-label={`Alternar acceso vendedor para ${row.resourceKey}`}
                    >
                      {row.vendedor ? '✓' : '—'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            Admin permanece con acceso total para evitar bloqueo del sistema.
          </div>
        )}
      </Card>
    </div>
  );
}
