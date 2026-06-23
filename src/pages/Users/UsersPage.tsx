import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit, Lock, Unlock, Archive, Key } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/helpers';
import { User, UserRole, UserStatus, Plan } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { usersApi, plansApi, CreateUserPayload, UpdateUserPayload } from '@/services/api';

const ROLE_OPTIONS = [
  { value: '', label: 'Todos los roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'asociado', label: 'Asociado' },
  { value: 'vendedor', label: 'Vendedor' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'activo', label: 'Activo' },
  { value: 'bloqueado', label: 'Bloqueado' },
  { value: 'archivado', label: 'Archivado' },
];

const STATUS_BADGE: Record<UserStatus, 'success' | 'warning' | 'danger'> = {
  activo: 'success',
  bloqueado: 'warning',
  archivado: 'danger',
};

const ROLE_BADGE: Record<UserRole, 'info' | 'secondary' | 'warning'> = {
  admin: 'info',
  asociado: 'secondary',
  vendedor: 'warning',
};

function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const reload = useCallback(() => {
    usersApi.list().then(setUsers).catch(() => {});
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { users, setUsers, reload };
}

interface UserFormData {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  planId: string;
  parentId: string;
  password: string;
}

const emptyForm: UserFormData = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  role: 'vendedor',
  planId: '',
  parentId: '',
  password: '',
};

const generateEmailFromName = (name: string, existingEmails: string[]): string => {
  if (!name) return '';
  const cleanName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim()
    .replace(/\s+/g, '.') // replace spaces with dots
    .replace(/[^a-z0-9._-]/g, ''); // keep alphanumeric, dots, underscores, and hyphens

  if (!cleanName) return '';

  const baseEmail = `${cleanName}@pmcomercial.com`;
  if (!existingEmails.includes(baseEmail)) {
    return baseEmail;
  }

  let counter = 1;
  while (true) {
    const suffix = counter.toString().padStart(2, '0'); // '01', '02', etc.
    const candidateEmail = `${cleanName}${suffix}@pmcomercial.com`;
    if (!existingEmails.includes(candidateEmail)) {
      return candidateEmail;
    }
    counter++;
  }
};

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const { users, setUsers, reload } = useUsers();
  const canCreateUser = hasPermission('/users:create');
  const canUpdateUser = hasPermission('/users:update');
  const canChangeStatus = hasPermission('/users:status');
  const canChangePassword = hasPermission('/users:password');
  const canShowActions = canUpdateUser || canChangeStatus || canChangePassword;

  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => { plansApi.list().then(setPlans).catch(() => {}); }, []);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pwModalUser, setPwModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formError, setFormError] = useState('');

  const associates = users.filter((u) => u.role === 'asociado');

  const filtered = users.filter((u) => {
    const matchSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const userById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const hierarchyRoots = useMemo(() => {
    const ids = new Set(filtered.map((u) => u.id));
    return filtered
      .filter((u) => !u.parentId || !ids.has(u.parentId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [filtered]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, User[]>();
    filtered.forEach((u) => {
      if (!u.parentId) return;
      const children = map.get(u.parentId) ?? [];
      children.push(u);
      map.set(u.parentId, children);
    });
    map.forEach((children) => children.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    return map;
  }, [filtered]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      phone: u.phone,
      role: u.role,
      planId: u.planId ?? '',
      parentId: u.parentId ?? '',
      password: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.fullName || !form.username || !form.email) {
      setFormError('Nombre, usuario y correo son requeridos.');
      return;
    }
    if (!editingUser && !form.password) {
      setFormError('La contraseña es requerida para nuevos usuarios.');
      return;
    }

    try {
      if (editingUser) {
        const payload: UpdateUserPayload = {
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          phone: form.phone,
          role: form.role,
          planId: form.planId || null,
          parentId: form.parentId || null,
        };
        const updated = await usersApi.update(editingUser.id, payload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const payload: CreateUserPayload = {
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
          planId: form.planId || undefined,
          parentId: form.parentId || undefined,
        };
        await usersApi.create(payload);
        reload();
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFormError(msg ?? 'Error al guardar. Intenta de nuevo.');
    }
  };

  const toggleBlock = async (u: User) => {
    const newStatus = u.status === 'bloqueado' ? 'activo' : 'bloqueado';
    try {
      const updated = await usersApi.changeStatus(u.id, newStatus);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch { /* ignore */ }
  };

  const archiveUser = async (u: User) => {
    try {
      const updated = await usersApi.changeStatus(u.id, 'archivado');
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch { /* ignore */ }
  };

  const savePassword = async () => {
    if (!pwModalUser || !newPassword) return;
    try {
      await usersApi.changePassword(pwModalUser.id, newPassword);
    } catch { /* ignore */ }
    setPwModalUser(null);
    setNewPassword('');
  };

  const renderActions = (u: User) => {
    if (!canShowActions) return null;

    return (
      <div className="flex items-center justify-end gap-1">
        {canUpdateUser && (
          <button
            title="Editar"
            onClick={() => openEdit(u)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit size={15} />
          </button>
        )}
        {canChangeStatus && (
          <>
            <button
              title={u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
              onClick={() => toggleBlock(u)}
              disabled={u.id === currentUser?.id}
              className="p-1.5 text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-30"
            >
              {u.status === 'bloqueado' ? <Unlock size={15} /> : <Lock size={15} />}
            </button>
            <button
              title="Archivar"
              onClick={() => archiveUser(u)}
              disabled={u.id === currentUser?.id || u.status === 'archivado'}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
            >
              <Archive size={15} />
            </button>
          </>
        )}
        {canChangePassword && (
          <button
            title="Cambiar contraseña"
            onClick={() => {
              setPwModalUser(u);
              setNewPassword('');
            }}
            className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Key size={15} />
          </button>
        )}
      </div>
    );
  };

  const renderHierarchyNode = (u: User, path: Set<string> = new Set()): React.ReactNode => {
    const hasCycle = path.has(u.id);
    const nextPath = new Set(path);
    nextPath.add(u.id);
    const children = hasCycle ? [] : (childrenByParent.get(u.id) ?? []);
    const parentName = u.parentId ? userById.get(u.parentId)?.fullName : null;

    return (
      <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">{u.fullName}</p>
              <Badge variant={ROLE_BADGE[u.role]} className="capitalize">{u.role}</Badge>
              <Badge variant={STATUS_BADGE[u.status]} className="capitalize">{u.status}</Badge>
            </div>
            <p className="text-sm text-slate-600">@{u.username} • {u.email}</p>
            {parentName && (
              <p className="text-xs text-slate-500 mt-1">Padre: {parentName}</p>
            )}
          </div>
          {renderActions(u)}
        </div>

        {hasCycle && (
          <p className="mt-2 text-xs text-red-600">Relación circular detectada en la jerarquía.</p>
        )}

        {children.length > 0 && (
          <div className="mt-3 ml-3 border-l-2 border-slate-200 pl-3 space-y-2">
            {children.map((child) => renderHierarchyNode(child, nextPath))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">Gestión de usuarios del sistema</p>
        </div>
        {canCreateUser && (
          <Button onClick={openCreate} size="md">
            <Plus size={16} />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Buscar usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select
              options={ROLE_OPTIONS}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-40"
            />
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44"
            />
            <div className="ml-auto inline-flex rounded-lg border border-slate-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Vista normal
              </button>
              <button
                type="button"
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-2 text-sm transition-colors border-l border-slate-300 ${viewMode === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Vista jerárquica
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Users views */}
      <Card>
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Correo</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Rol</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Creado</th>
                  {canShowActions && (
                    <th className="text-right px-4 py-3 text-slate-600 font-medium">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canShowActions ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                      No hay usuarios que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">{u.username}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_BADGE[u.role]} className="capitalize">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[u.status]} className="capitalize">
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                      {canShowActions && (
                        <td className="px-4 py-3">{renderActions(u)}</td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-500 py-6">No hay usuarios que coincidan con los filtros.</p>
            ) : (
              hierarchyRoots.map((u) => renderHierarchyNode(u))
            )}
          </CardBody>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {(canCreateUser || canUpdateUser) && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
          size="md"
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {formError}
            </div>
          )}
          <Input
            label="Nombre completo"
            value={form.fullName}
            onChange={(e) => {
              const newFullName = e.target.value;
              const existingEmails = users.map((u) => u.email.toLowerCase());
              setForm((prev) => {
                const oldGeneratedEmail = generateEmailFromName(prev.fullName, existingEmails);
                const newGeneratedEmail = generateEmailFromName(newFullName, existingEmails);
                const shouldAutoFill = !editingUser && (prev.email === '' || prev.email === oldGeneratedEmail);
                return {
                  ...prev,
                  fullName: newFullName,
                  email: shouldAutoFill ? newGeneratedEmail : prev.email
                };
              });
            }}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Usuario"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <Input
            label="Correo electrónico"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Rol"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              options={[
                ...(currentUser?.role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
                { value: 'asociado', label: 'Asociado' },
                { value: 'vendedor', label: 'Vendedor' },
              ]}
            />
            <Select
              label="Plan"
              value={form.planId}
              onChange={(e) => setForm({ ...form, planId: e.target.value })}
              options={[
                { value: '', label: 'Sin plan' },
                ...plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
          {form.role !== 'admin' && (
            <Select
              label="Asociado padre"
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              options={[
                { value: '', label: 'Sin padre' },
                ...associates
                  .filter((a) => a.id !== editingUser?.id)
                  .map((a) => ({ value: a.id, label: a.fullName })),
              ]}
            />
          )}
          {!editingUser && (
            <Input
              label="Contraseña inicial"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingUser ? 'Guardar cambios' : 'Crear usuario'}</Button>
          </div>
          </form>
        </Modal>
      )}

      {/* Password Modal */}
      {canChangePassword && (
        <Modal
          open={!!pwModalUser}
          onClose={() => setPwModalUser(null)}
          title="Cambiar contraseña"
          size="sm"
        >
          <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Cambiando contraseña para: <strong>{pwModalUser?.fullName}</strong>
          </p>
          <Input
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPwModalUser(null)}>
              Cancelar
            </Button>
            <Button onClick={savePassword}>Guardar</Button>
          </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
