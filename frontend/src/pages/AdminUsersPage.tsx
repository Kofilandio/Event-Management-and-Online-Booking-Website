import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { FullUser } from '../lib/types';

export function AdminUsersPage() {
  const [users, setUsers] = useState<FullUser[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [q, setQ] = useState('');

  function load() {
    const params = new URLSearchParams();
    params.set('status', filter);
    if (q) params.set('q', q);
    api<FullUser[]>(`/admin/users?${params}`).then(setUsers);
  }

  useEffect(load, [filter]);

  return (
    <div className="container">
      <h2>Διαχείριση Χρηστών</h2>
      <div className="card">
        <div className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="ALL">Όλοι</option>
            <option value="PENDING">Εκκρεμείς</option>
            <option value="APPROVED">Εγκεκριμένοι</option>
            <option value="REJECTED">Απορριφθέντες</option>
          </select>
          <input
            placeholder="Αναζήτηση (username, email, name)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ flex: 1 }}
          />
          <button onClick={load}>Αναζήτηση</button>
        </div>
      </div>
      {users === null && <p className="muted">Φορτώνεται…</p>}
      {users && (
        <table>
          <thead>
            <tr><th>Username</th><th>Όνομα</th><th>Email</th><th>Πόλη</th><th>Ρόλος</th><th>Κατάσταση</th><th>Ενέργειες</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link to={`/admin/users/${u.id}`}>{u.username}</Link></td>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.city}</td>
                <td>{u.role}</td>
                <td><span className={`tag status-${u.status}`}>{u.status}</span></td>
                <td><Link to={`/admin/users/${u.id}`}>Λεπτομέρειες →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
