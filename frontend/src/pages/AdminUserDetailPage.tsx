import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { FullUser } from '../lib/types';

export function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<FullUser | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<FullUser>(`/admin/users/${id}`).then(setUser);
  }
  useEffect(load, [id]);

  async function decide(decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    try {
      await api(`/admin/users/${id}/decision`, { method: 'POST', body: { decision } });
      load();
    } finally { setBusy(false); }
  }

  if (!user) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <button className="secondary" onClick={() => navigate('/admin/users')}>← Λίστα χρηστών</button>
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>{user.firstName} {user.lastName}</h2>
          <span className={`tag status-${user.status}`}>{user.status}</span>
        </div>
        <div className="muted">@{user.username} · {user.role}</div>
        <div className="grid two" style={{ marginTop: '1rem' }}>
          <div><label>Email</label><div>{user.email}</div></div>
          <div><label>Τηλέφωνο</label><div>{user.phone}</div></div>
          <div><label>Διεύθυνση</label><div>{user.address}</div></div>
          <div><label>Πόλη/Χώρα</label><div>{user.city}, {user.country}</div></div>
          <div><label>Γεωγραφικές συντεταγμένες</label><div>{user.latitude ?? '—'}, {user.longitude ?? '—'}</div></div>
          <div><label>ΑΦΜ</label><div>{user.afm}</div></div>
          <div><label>Εγγραφή</label><div>{new Date(user.createdAt).toLocaleString()}</div></div>
        </div>

        {user.status === 'PENDING' && (
          <div className="row" style={{ marginTop: '1rem' }}>
            <button className="success" disabled={busy} onClick={() => decide('APPROVE')}>Έγκριση</button>
            <button className="danger" disabled={busy} onClick={() => decide('REJECT')}>Απόρριψη</button>
          </div>
        )}
      </div>
    </div>
  );
}
