import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactElement } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/Login/LoginPage';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import UsersPage from '@/pages/Users/UsersPage';
import RolesPage from '@/pages/Roles/RolesPage';
import PlansPage from '@/pages/Plans/PlansPage';
import DrawsPage from '@/pages/Draws/DrawsPage';
import MultiplicadoresEspecialesPage from '@/pages/MultiplicadoresEspeciales/MultiplicadoresEspecialesPage';
import SalesPage from '@/pages/Sales/SalesPage';
import ReportsPage from '@/pages/Reports/ReportsPage';
import BalanceBreakdownPage from '@/pages/Reports/BalanceBreakdownPage';
import SalesByUserPage from '@/pages/Reports/SalesByUserPage';
import DrawListsPage from '@/pages/Reports/DrawListsPage';
import PrintQueuePage from '@/pages/PrintQueue/PrintQueuePage';
import TicketPaymentsPage from '@/pages/TicketPayments/TicketPaymentsPage';
import CommissionsPage from '@/pages/Reports/CommissionsPage';
import CashMovementsPage from '@/pages/CashMovements/CashMovementsPage';
import AnnouncementsPage from '@/pages/Announcements/AnnouncementsPage';
import FrontendSettingsPage from '@/pages/FrontendSettings/FrontendSettingsPage';
import ReportingFiltersSettingsPage from '@/pages/ReportingFiltersSettings/ReportingFiltersSettingsPage';
import NumberRestrictionsPage from '@/pages/NumberRestrictions/NumberRestrictionsPage';
import GlobalNumberRestrictionsPage from '@/pages/Restrictions/GlobalNumberRestrictionsPage';
import UserGlobalRestrictionsPage from '@/pages/Restrictions/UserGlobalRestrictionsPage';
import UserSalesRestrictionsPage from '@/pages/Restrictions/UserSalesRestrictionsPage';

function ProtectedByPermission({ resourceKey, element }: { resourceKey: string; element: ReactElement }) {
  const { isAuthenticated, permissionsLoaded, hasPermission } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!permissionsLoaded) return null;
  if (!hasPermission(resourceKey)) return <Navigate to="/dashboard" replace />;

  return element;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<ProtectedByPermission resourceKey="/dashboard" element={<DashboardPage />} />} />
            <Route path="/users" element={<ProtectedByPermission resourceKey="/users" element={<UsersPage />} />} />
            <Route path="/roles" element={<ProtectedByPermission resourceKey="/roles" element={<RolesPage />} />} />
            <Route path="/plans" element={<ProtectedByPermission resourceKey="/plans" element={<PlansPage />} />} />
            <Route path="/draws" element={<ProtectedByPermission resourceKey="/draws" element={<DrawsPage />} />} />
            <Route path="/restrictions/global" element={<ProtectedByPermission resourceKey="/restrictions/global" element={<NumberRestrictionsPage />} />} />
            <Route path="/restrictions/global-numbers" element={<ProtectedByPermission resourceKey="/restrictions/global-numbers" element={<GlobalNumberRestrictionsPage />} />} />
            <Route path="/restrictions/user-global" element={<ProtectedByPermission resourceKey="/restrictions/user-global" element={<UserGlobalRestrictionsPage />} />} />
            <Route path="/restrictions/user-sales-limit" element={<ProtectedByPermission resourceKey="/restrictions/user-sales-limit" element={<UserSalesRestrictionsPage />} />} />
            <Route path="/number-restrictions" element={<ProtectedByPermission resourceKey="/restrictions/global" element={<Navigate to="/restrictions/global" replace />} />} />
            <Route path="/multiplicadores" element={<ProtectedByPermission resourceKey="/multiplicadores" element={<MultiplicadoresEspecialesPage />} />} />
            <Route path="/sales" element={<ProtectedByPermission resourceKey="/sales" element={<SalesPage />} />} />
            <Route path="/ticket-payments" element={<ProtectedByPermission resourceKey="/ticket-payments" element={<TicketPaymentsPage />} />} />
            <Route path="/cash-movements" element={<ProtectedByPermission resourceKey="/cash-movements" element={<CashMovementsPage />} />} />
            <Route path="/announcements" element={<ProtectedByPermission resourceKey="/announcements" element={<AnnouncementsPage />} />} />
            <Route path="/frontend-settings" element={<ProtectedByPermission resourceKey="/roles:update" element={<FrontendSettingsPage />} />} />
            <Route
              path="/frontend-settings/reporting-filters"
              element={<ProtectedByPermission resourceKey="/frontend-settings/reporting-filters" element={<ReportingFiltersSettingsPage />} />}
            />
            <Route path="/reports" element={<ProtectedByPermission resourceKey="/reports" element={<Navigate to="/reports/sales-stats" replace />} />} />
            <Route path="/reports/sales-stats" element={<ProtectedByPermission resourceKey="/reports/sales-stats" element={<ReportsPage />} />} />
            <Route path="/reports/balance-breakdown" element={<ProtectedByPermission resourceKey="/reports/balance-breakdown" element={<BalanceBreakdownPage />} />} />
            <Route path="/reports/sales-by-user" element={<ProtectedByPermission resourceKey="/reports/sales-by-user" element={<SalesByUserPage />} />} />
            <Route path="/reports/draw-lists" element={<ProtectedByPermission resourceKey="/reports/draw-lists" element={<DrawListsPage />} />} />
            <Route path="/reports/commissions" element={<ProtectedByPermission resourceKey="/reports/commissions" element={<CommissionsPage />} />} />
            <Route path="/print-queue" element={<ProtectedByPermission resourceKey="/print-queue" element={<PrintQueuePage />} />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
