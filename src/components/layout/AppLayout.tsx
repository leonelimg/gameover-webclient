import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import { AnnouncementModal } from '@/components/AnnouncementModal';

export function AppLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 lg:ml-60 p-4 lg:p-8 pt-16 lg:pt-8">
        <Outlet />
      </main>
      <AnnouncementModal />
    </div>
  );
}
