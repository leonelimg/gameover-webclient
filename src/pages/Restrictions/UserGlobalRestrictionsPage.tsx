import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { numberRestrictionsApi } from '@/services/api';
import { UserRestrictionLimitItem } from '@/types';
import { formatCurrency } from '@/utils/helpers';

function parseLimit(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Ingresa un monto positivo o deja el campo vacío para desactivar la restricción.');
  }
  return parsed;
}

export default function UserGlobalRestrictionsPage() {
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserRestrictionLimitItem[]>([]);
  const [globalDrafts, setGlobalDrafts] = useState<Record<string, string>>({});
  const [restrictedDrafts, setRestrictedDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = async (searchValue: string) => {
    setLoading(true);
    setError('');

    try {
      const items = await numberRestrictionsApi.listUserLimits(searchValue || undefined);
      setUsers(items);
      setGlobalDrafts(
        Object.fromEntries(
          items.map((user) => [
            user.id,
            user.userGlobalLimit === null ? '' : String(user.userGlobalLimit),
          ])
        )
      );
      setRestrictedDrafts(
        Object.fromEntries(
          items.map((user) => [
            user.id,
            user.userRestrictedNumbersLimit === null ? '' : String(user.userRestrictedNumbersLimit),
          ])
        )
      );
    } catch {
      setError('No se pudieron cargar los usuarios con restricciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers('');
  }, []);

  const filteredCountText = useMemo(() => {
    if (loading) return 'Cargando...';
    return `${users.length} usuario${users.length === 1 ? '' : 's'}`;
  }, [users.length, loading]);

  const saveUserLimit = async (user: UserRestrictionLimitItem) => {
    setError('');
    setSuccess('');

    let globalLimit: number | null = null;
    let restrictedLimit: number | null = null;
    try {
      globalLimit = parseLimit(globalDrafts[user.id] ?? '');
    } catch (parseError) {
      setError(parseError instanceof Error ? `Límite General: ${parseError.message}` : 'Límite General inválido.');
      return;
    }
    try {
      restrictedLimit = parseLimit(restrictedDrafts[user.id] ?? '');
    } catch (parseError) {
      setError(parseError instanceof Error ? `Límite Restringidos: ${parseError.message}` : 'Límite Restringidos inválido.');
      return;
    }

    setSavingUserId(user.id);
    try {
      const [updatedGlobal, updatedRestricted] = await Promise.all([
        numberRestrictionsApi.updateUserGlobalLimit(user.id, globalLimit),
        numberRestrictionsApi.updateUserRestrictedNumbersLimit(user.id, restrictedLimit),
      ]);

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? {
                ...item,
                userGlobalLimit: updatedGlobal.userGlobalLimit,
                userRestrictedNumbersLimit: updatedRestricted.userRestrictedNumbersLimit,
                userDrawSaleLimit: updatedGlobal.userDrawSaleLimit,
              }
            : item
        )
      );

      setGlobalDrafts((prev) => ({
        ...prev,
        [user.id]: updatedGlobal.userGlobalLimit === null ? '' : String(updatedGlobal.userGlobalLimit),
      }));
      setRestrictedDrafts((prev) => ({
        ...prev,
        [user.id]: updatedRestricted.userRestrictedNumbersLimit === null ? '' : String(updatedRestricted.userRestrictedNumbersLimit),
      }));

      setSuccess(`Restricciones guardadas correctamente para ${user.fullName}.`);
    } catch {
      setError('No se pudieron guardar las restricciones del usuario.');
    } finally {
      setSavingUserId('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Restricción global por usuario</h1>
        <p className="text-sm text-slate-500">
          Define un límite base por número para cada usuario en cualquier sorteo. Esta restricción predomina sobre la global general y solo es superada por la individual por número del sorteo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Usuarios</h2>
              <p className="text-xs text-slate-500">{filteredCountText}</p>
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <Input
                label=""
                placeholder="Buscar por nombre o usuario"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => loadUsers(search.trim())}
              >
                Buscar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Cargando usuarios...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-slate-500">No hay usuarios para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Usuario</th>
                    <th className="pb-2 pr-4 font-medium">Rol</th>
                    <th className="pb-2 pr-4 font-medium">Límite General</th>
                    <th className="pb-2 pr-4 font-medium">Nuevo Límite General</th>
                    <th className="pb-2 pr-4 font-medium">Límite Restringidos</th>
                    <th className="pb-2 pr-4 font-medium">Nuevo Límite Restringidos</th>
                    <th className="pb-2 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="py-2 pr-4">
                        <p className="font-medium text-slate-800">{user.fullName}</p>
                        <p className="text-xs text-slate-500">@{user.username}</p>
                      </td>
                      <td className="py-2 pr-4 capitalize text-slate-600">{user.role}</td>
                      <td className="py-2 pr-4 text-slate-700">
                        {user.userGlobalLimit === null ? 'Sin límite' : formatCurrency(user.userGlobalLimit)}
                      </td>
                      <td className="py-2 pr-4 min-w-44">
                        <Input
                          label=""
                          type="number"
                          min="1"
                          step="0.01"
                          placeholder="Vacío para desactivar"
                          value={globalDrafts[user.id] ?? ''}
                          onChange={(e) =>
                            setGlobalDrafts((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                          disabled={savingUserId === user.id}
                        />
                      </td>
                      <td className="py-2 pr-4 text-slate-700">
                        {user.userRestrictedNumbersLimit === null ? 'Sin límite' : formatCurrency(user.userRestrictedNumbersLimit)}
                      </td>
                      <td className="py-2 pr-4 min-w-44">
                        <Input
                          label=""
                          type="number"
                          min="1"
                          step="0.01"
                          placeholder="Vacío para desactivar"
                          value={restrictedDrafts[user.id] ?? ''}
                          onChange={(e) =>
                            setRestrictedDrafts((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                          disabled={savingUserId === user.id}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          loading={savingUserId === user.id}
                          disabled={savingUserId === user.id}
                          onClick={() => saveUserLimit(user)}
                        >
                          Guardar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
