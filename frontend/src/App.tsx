import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Navbar } from './components/Navbar';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HomePage } from './pages/HomePage';
import { BrowseEventsPage } from './pages/BrowseEventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { MyEventsPage } from './pages/MyEventsPage';
import { EventEditorPage } from './pages/EventEditorPage';
import { EventBookingsPage } from './pages/EventBookingsPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { MessagesPage } from './pages/MessagesPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminUserDetailPage } from './pages/AdminUserDetailPage';
import { AdminExportPage } from './pages/AdminExportPage';

function Protected({ children, role }: { children: JSX.Element; role?: 'ADMIN' }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/home" replace />;
  return children;
}

function PublicHome() {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  if (user) {
    return user.role === 'ADMIN' ? <Navigate to="/admin/users" replace /> : <Navigate to="/home" replace />;
  }
  return <WelcomePage />;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* registered users */}
        <Route path="/home" element={<Protected><HomePage /></Protected>} />
        <Route path="/events" element={<BrowseEventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/my-events" element={<Protected><MyEventsPage /></Protected>} />
        <Route path="/my-events/new" element={<Protected><EventEditorPage mode="create" /></Protected>} />
        <Route path="/my-events/:id/edit" element={<Protected><EventEditorPage mode="edit" /></Protected>} />
        <Route path="/my-events/:id/bookings" element={<Protected><EventBookingsPage /></Protected>} />
        <Route path="/my-bookings" element={<Protected><MyBookingsPage /></Protected>} />
        <Route path="/messages" element={<Protected><MessagesPage /></Protected>} />

        {/* admin */}
        <Route path="/admin/users" element={<Protected role="ADMIN"><AdminUsersPage /></Protected>} />
        <Route path="/admin/users/:id" element={<Protected role="ADMIN"><AdminUserDetailPage /></Protected>} />
        <Route path="/admin/export" element={<Protected role="ADMIN"><AdminExportPage /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
