import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/draws" element={<DrawsPage />} />
            <Route path="/multiplicadores" element={<MultiplicadoresEspecialesPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/ticket-payments" element={<TicketPaymentsPage />} />
            <Route path="/reports" element={<Navigate to="/reports/sales-stats" replace />} />
            <Route path="/reports/sales-stats" element={<ReportsPage />} />
            <Route path="/reports/balance-breakdown" element={<BalanceBreakdownPage />} />
            <Route path="/reports/sales-by-user" element={<SalesByUserPage />} />
            <Route path="/reports/draw-lists" element={<DrawListsPage />} />
            <Route path="/print-queue" element={<PrintQueuePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
