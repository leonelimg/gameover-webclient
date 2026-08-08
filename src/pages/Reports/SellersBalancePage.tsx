import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DateRangeSegmentedControl } from '@/components/ui/DateRangeSegmentedControl';
import { usersApi, cashMovementsApi } from '@/services/api';
import { User } from '@/types';
import { formatCurrency } from '@/utils/helpers';
import { DateRange, getDateRange, isDateRange, toISODateLocal } from '@/utils/dateRanges';
import { useAuth } from '@/context/AuthContext';
import { loadFrontendTicketSettings } from '@/utils/ticketAppearance';

const BALANCE_RANGE_KEY = 'go_sellers_balance_selected_range';
const BALANCE_CUSTOM_FROM_KEY = 'go_sellers_balance_custom_from_date';
const BALANCE_CUSTOM_TO_KEY = 'go_sellers_balance_custom_to_date';

function SellerBalanceRow({
  name,
  balance,
  indented = false,
  variant = 'seller',
  expandable = false,
  isExpanded = false,
  onToggleExpand,
  statusNode,
}: {
  name: string;
  balance: number;
  indented?: boolean;
  variant?: 'grand-total' | 'associate-total' | 'seller';
  expandable?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  statusNode?: React.ReactNode;
}) {
  const rowClass =
    variant === 'grand-total'
      ? 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200'
      : variant === 'associate-total'
        ? 'bg-blue-100 border-blue-200 hover:bg-blue-200'
        : 'bg-white border-slate-100 hover:bg-slate-50';

  const textClass =
    variant === 'grand-total'
      ? 'font-bold text-slate-950'
      : variant === 'associate-total'
        ? 'font-semibold text-slate-900'
        : 'font-medium text-slate-800';

  const nameTextClass =
    variant === 'grand-total'
      ? 'text-emerald-950'
      : variant === 'associate-total'
        ? 'text-blue-950'
        : 'text-slate-700';

  const balanceColorClass =
    balance >= 0
      ? variant === 'grand-total'
        ? 'text-emerald-900'
        : variant === 'associate-total'
          ? 'text-emerald-800'
          : 'text-emerald-700'
      : variant === 'grand-total'
        ? 'text-red-900'
        : variant === 'associate-total'
          ? 'text-red-800'
          : 'text-red-700';

  return (
    <tr
      className={`border-t ${rowClass} ${expandable && onToggleExpand ? 'cursor-pointer' : ''}`}
      onClick={expandable && onToggleExpand ? onToggleExpand : undefined}
    >
      <td className={`px-4 py-3 ${nameTextClass} ${textClass} ${indented ? 'pl-10' : ''}`}>
        <div className="flex items-center gap-2">
          {expandable && onToggleExpand && (
            <span className="text-slate-400 flex-shrink-0">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          {expandable && !onToggleExpand && <span className="w-4 flex-shrink-0" />}
          <span>{name}</span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        {statusNode}
      </td>
      <td className={`px-4 py-3 text-right ${balanceColorClass} ${textClass}`}>
        {formatCurrency(balance)}
      </td>
    </tr>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'indigo';
}) {
  const styleMap = {
    blue: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-blue-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-blue-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    purple: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-violet-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-violet-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    green: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-emerald-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-emerald-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    orange: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-orange-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-orange-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    red: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-red-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-red-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
    indigo: {
      card: 'bg-slate-900 border-slate-800 border-t-4 border-t-indigo-500 text-white shadow-sm hover:border-slate-700',
      icon: 'bg-slate-950 text-indigo-400',
      value: 'text-white font-bold',
      label: 'text-slate-400',
    },
  };

  const styles = styleMap[color];

  return (
    <div className={`p-2.5 px-3 rounded-xl border shadow-sm transition-all duration-300 flex items-center gap-3 ${styles.card}`}>
      <div className={`inline-flex p-1.5 rounded-lg ${styles.icon} flex-shrink-0`}>{icon}</div>
      <div>
        <p className={`text-xs font-medium ${styles.label} leading-none`}>{label}</p>
        <p className={`text-xl font-bold ${styles.value} mt-1.5 leading-none`}>{value}</p>
      </div>
    </div>
  );
}

export default function SellersBalancePage() {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [expandedAssociates, setExpandedAssociates] = useState<Set<string>>(new Set());
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const saved = localStorage.getItem(BALANCE_CUSTOM_FROM_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [customToDate, setCustomToDate] = useState<string>(() => {
    const saved = localStorage.getItem(BALANCE_CUSTOM_TO_KEY);
    return saved || toISODateLocal(new Date());
  });
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem(BALANCE_RANGE_KEY);
    if (saved && isDateRange(saved)) {
      return saved;
    }
    return 'today';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [thresholds, setThresholds] = useState<{ normal: number; warning: number }>({ normal: 1000, warning: 5000 });

  useEffect(() => {
    usersApi.list().then(setUsers).catch(() => {});
    loadFrontendTicketSettings(true)
      .then((settings) => {
        setThresholds({
          normal: settings.balanceThresholdNormal,
          warning: settings.balanceThresholdWarning,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(BALANCE_RANGE_KEY, selectedRange);
  }, [selectedRange]);

  useEffect(() => {
    localStorage.setItem(BALANCE_CUSTOM_FROM_KEY, customFromDate);
  }, [customFromDate]);

  useEffect(() => {
    localStorage.setItem(BALANCE_CUSTOM_TO_KEY, customToDate);
  }, [customToDate]);

  // Determine associates and sellers hierarchy
  const hierarchyData = useMemo(() => {
    if (!user) return { associates: [], sellers: [] };

    let filteredUsers = users;

    // Filter by selected user if set
    if (selectedUserId) {
      filteredUsers = users.filter(u => u.id === selectedUserId || u.parentId === selectedUserId);
    }

    let associates: User[] = [];
    let sellers: User[] = [];

    if (user.role === 'asociado') {
      // An associate only sees themselves and their own sellers
      associates = users.filter(u => u.id === user.id);
      sellers = filteredUsers.filter(u => u.role === 'vendedor' && u.parentId === user.id);
    } else {
      // Admins see all active/available associates and sellers
      associates = users.filter(u => u.role === 'asociado');
      sellers = filteredUsers.filter(u => u.role === 'vendedor');
    }

    return { associates, sellers };
  }, [users, user, selectedUserId]);

  useEffect(() => {
    const fetchBalances = async () => {
      setLoading(true);
      setError('');

      const isCustomRange = selectedRange === 'custom';
      if (isCustomRange && (!customFromDate || !customToDate || customFromDate > customToDate)) {
        setBalances({});
        setLoading(false);
        return;
      }

      const { fromDate, toDate } = isCustomRange
        ? { fromDate: customFromDate, toDate: customToDate }
        : getDateRange(selectedRange);

      const targetSellers = hierarchyData.sellers;
      if (targetSellers.length === 0) {
        setBalances({});
        setLoading(false);
        return;
      }

      try {
        const promises = targetSellers.map(async (seller) => {
          try {
            const res = await cashMovementsApi.balance({
              targetUserId: seller.id,
              fromDate: fromDate || undefined,
              toDate: toDate || undefined,
            });
            return { userId: seller.id, balance: res.totals.balance };
          } catch {
            return { userId: seller.id, balance: 0 };
          }
        });

        const results = await Promise.all(promises);
        const newBalances: Record<string, number> = {};
        results.forEach((r) => {
          newBalances[r.userId] = r.balance;
        });

        setBalances(newBalances);
      } catch (err) {
        setError('No fue posible cargar los saldos de los vendedores.');
        setBalances({});
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [hierarchyData.sellers, selectedRange, customFromDate, customToDate]);

  const resetFilters = () => {
    setSelectedUserId('');
    setSelectedRange('today');
  };

  const toggleAssociateExpand = (associateId: string) => {
    setExpandedAssociates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(associateId)) {
        newSet.delete(associateId);
      } else {
        newSet.add(associateId);
      }
      return newSet;
    });
  };

  const getBalanceStatus = (balance: number) => {
    if (balance <= thresholds.normal) return 'BIEN';
    if (balance <= thresholds.warning) return 'ALERTA';
    return 'CRITICO';
  };

  // Calculations for displays
  const associateData = useMemo(() => {
    return hierarchyData.associates.map((assoc) => {
      const assocSellers = hierarchyData.sellers.filter(s => s.parentId === assoc.id);
      const balance = assocSellers.reduce((sum, s) => sum + (balances[s.id] ?? 0), 0);

      // Totalize status counters
      let bienCount = 0;
      let alertaCount = 0;
      let criticoCount = 0;

      assocSellers.forEach((s) => {
        const sBalance = balances[s.id] ?? 0;
        const status = getBalanceStatus(sBalance);
        if (status === 'BIEN') bienCount++;
        else if (status === 'ALERTA') alertaCount++;
        else if (status === 'CRITICO') criticoCount++;
      });

      return {
        ...assoc,
        balance,
        sellers: assocSellers,
        bienCount,
        alertaCount,
        criticoCount,
      };
    }).filter(assoc => assoc.sellers.length > 0 || !selectedUserId);
  }, [hierarchyData.associates, hierarchyData.sellers, balances, selectedUserId, thresholds]);

  const grandTotalBalance = useMemo(() => {
    return associateData.reduce((sum, assoc) => sum + assoc.balance, 0);
  }, [associateData]);

  // List of users to select in filter dropdown (associates and sellers)
  const selectableUsers = useMemo(() => {
    if (user?.role === 'asociado') {
      return users.filter(u => u.role === 'vendedor' && u.parentId === user.id);
    }
    return users.filter(u => u.role === 'asociado' || u.role === 'vendedor');
  }, [users, user]);

  const renderStatusBadge = (status: 'BIEN' | 'ALERTA' | 'CRITICO') => {
    if (status === 'BIEN') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          BIEN
        </span>
      );
    }
    if (status === 'ALERTA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          ALERTA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        CRÍTICO
      </span>
    );
  };

  const renderAssociateCounters = (bien: number, alerta: number, critico: number) => {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {bien > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            {bien} BIEN
          </span>
        )}
        {alerta > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
            {alerta} ALERTA
          </span>
        )}
        {critico > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
            {critico} CRÍTICO
          </span>
        )}
        {bien === 0 && alerta === 0 && critico === 0 && (
          <span className="text-slate-400 font-normal">-</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Balance final por vendedor</h1>
        <p className="text-sm text-slate-500">Saldo final de cada vendedor agrupado por su asociado</p>
      </div>

      {/* Date range filter */}
      <DateRangeSegmentedControl
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        customFromDate={customFromDate}
        customToDate={customToDate}
        onCustomFromDateChange={setCustomFromDate}
        onCustomToDateChange={setCustomToDate}
      />

      {/* Additional filters */}
      <Card>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Select
              label="Usuario"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={[
                { value: '', label: 'Todos los usuarios' },
                ...selectableUsers.map((u) => ({
                  value: u.id,
                  label: `${u.fullName} (${u.username}) - ${u.role.toUpperCase()}`,
                })),
              ]}
            />
            <Button variant="secondary" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Balance Final Total"
          value={formatCurrency(grandTotalBalance)}
          color={grandTotalBalance >= 0 ? 'green' : 'red'}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Asociado / Vendedor</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Estado</th>
                <th className="text-right px-4 py-3 text-slate-600 font-medium w-48">Balance final</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Cargando reporte...
                  </td>
                </tr>
              ) : associateData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    No hay registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                <>
                  <SellerBalanceRow
                    name="Totales"
                    balance={grandTotalBalance}
                    variant="grand-total"
                  />
                  {associateData.map((associate) => (
                    <Fragment key={associate.id}>
                      <SellerBalanceRow
                        name={associate.fullName}
                        balance={associate.balance}
                        variant="associate-total"
                        expandable
                        isExpanded={expandedAssociates.has(associate.id)}
                        onToggleExpand={() => toggleAssociateExpand(associate.id)}
                        statusNode={renderAssociateCounters(associate.bienCount, associate.alertaCount, associate.criticoCount)}
                      />
                      {expandedAssociates.has(associate.id) &&
                        associate.sellers.map((seller) => {
                          const sBalance = balances[seller.id] ?? 0;
                          return (
                            <SellerBalanceRow
                              key={seller.id}
                              name={`${seller.fullName} (${seller.username})`}
                              balance={sBalance}
                              indented
                              variant="seller"
                              statusNode={renderStatusBadge(getBalanceStatus(sBalance))}
                            />
                          );
                        })}
                    </Fragment>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
