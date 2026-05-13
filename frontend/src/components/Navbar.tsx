import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user || user.role === 'ADMIN') return;
    let active = true;
    const tick = () => api<{ count: number }>('/messages/unread-count')
      .then((r) => active && setUnread(r.count))
      .catch(() => {});
    tick();
    const id = setInterval(tick, 20000);
    return () => { active = false; clearInterval(id); };
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <Link to={user ? (user.role === 'ADMIN' ? '/admin/users' : '/home') : '/'} className="brand">
        Διαχείριση Εκδηλώσεων
      </Link>
      <nav>
        {!user && (
          <>
            <Link to="/events">Browse Events</Link>
            <Link to="/login">Login</Link>
            <Link to="/register">Sign Up</Link>
          </>
        )}
        {user && user.role !== 'ADMIN' && (
          <>
            <Link to="/events">Browse Events</Link>
            <Link to="/my-events">My Events</Link>
            <Link to="/my-bookings">My Bookings</Link>
            <Link to="/messages">
              Messages{unread > 0 && <span className="badge">{unread}</span>}
            </Link>
            <span className="muted">{user.username}</span>
            <button className="secondary" onClick={handleLogout}>Logout</button>
          </>
        )}
        {user && user.role === 'ADMIN' && (
          <>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/export">Export</Link>
            <Link to="/events">Browse Events</Link>
            <span className="muted">admin</span>
            <button className="secondary" onClick={handleLogout}>Logout</button>
          </>
        )}
      </nav>
    </header>
  );
}
