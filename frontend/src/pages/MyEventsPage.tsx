import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Event } from '../lib/types';

export function MyEventsPage() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function load() {
    api<Event[]>('/events/mine').then(setEvents).catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  async function publish(id: number) {
    try { await api(`/events/${id}/publish`, { method: 'POST' }); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Failed'); }
  }
  async function cancel(id: number) {
    if (!confirm('Are you sure you want to cancel this event? All booked attendees will be notified.')) return;
    try { await api(`/events/${id}/cancel`, { method: 'POST' }); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Failed'); }
  }
  async function remove(id: number) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try { await api(`/events/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Failed'); }
  }

  return (
    <div className="container">
      <div className="row between">
        <h2>Οι εκδηλώσεις μου</h2>
        <button onClick={() => navigate('/my-events/new')}>+ Νέα εκδήλωση</button>
      </div>
      {error && <div className="error">{error}</div>}
      {events === null && <p className="muted">Φορτώνεται…</p>}
      {events && events.length === 0 && <p className="muted">Δεν έχετε δημιουργήσει εκδηλώσεις ακόμα.</p>}
      {events && events.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Τίτλος</th><th>Ημερομηνία</th><th>Κατάσταση</th><th>Κρατήσεις</th><th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><Link to={`/events/${e.id}`}>{e.title}</Link></td>
                <td>{new Date(e.startDateTime).toLocaleString()}</td>
                <td><span className={`tag status-${e.status}`}>{e.status}</span></td>
                <td>
                  <Link to={`/my-events/${e.id}/bookings`}>{e._count?.bookings ?? 0}</Link>
                </td>
                <td>
                  <div className="row end">
                    {e.status === 'DRAFT' && (
                      <button className="success" onClick={() => publish(e.id)}>Δημοσίευση</button>
                    )}
                    {e.status !== 'CANCELLED' && e.status !== 'COMPLETED' && (
                      <button className="secondary" onClick={() => navigate(`/my-events/${e.id}/edit`)}>Επεξεργασία</button>
                    )}
                    {e.status === 'PUBLISHED' && (
                      <button className="danger" onClick={() => cancel(e.id)}>Ακύρωση</button>
                    )}
                    {(e.status === 'DRAFT' || (e._count?.bookings ?? 0) === 0) && (
                      <button className="danger" onClick={() => remove(e.id)}>Διαγραφή</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
