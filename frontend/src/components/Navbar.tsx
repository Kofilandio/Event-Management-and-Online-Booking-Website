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
            <Link to="/events">Εκδηλώσεις</Link>
            <Link to="/login">Σύνδεση</Link>
            <Link to="/register">Εγγραφή</Link>
          </>
        )}
        {user && user.role !== 'ADMIN' && (
          <>
            <Link to="/events">Εκδηλώσεις</Link>
            <Link to="/my-events">Οι εκδηλώσεις μου</Link>
            <Link to="/my-bookings">Οι κρατήσεις μου</Link>
            <Link to="/messages">
              Μηνύματα{unread > 0 && <span className="badge">{unread}</span>}
            </Link>
            <span className="muted">{user.username}</span>
            <button className="secondary" onClick={handleLogout}>Αποσύνδεση</button>
          </>
        )}
        {user && user.role === 'ADMIN' && (
          <>
            <Link to="/admin/users">Χρήστες</Link>
            <Link to="/admin/export">Εξαγωγή</Link>
            <Link to="/events">Εκδηλώσεις</Link>
            <span className="muted">admin</span>
            <button className="secondary" onClick={handleLogout}>Αποσύνδεση</button>
          </>
        )}
      </nav>
    </header>
  );
}
