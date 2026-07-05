import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking } from '../lib/types';

export function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Booking[]>('/bookings/mine').then(setBookings).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="container">
      <h2>Οι κρατήσεις μου</h2>
      {error && <div className="error">{error}</div>}
      {bookings === null && <p className="muted">Φορτώνεται…</p>}
      {bookings && bookings.length === 0 && <p className="muted">Δεν έχετε κάνει κρατήσεις.</p>}
      {bookings && bookings.length > 0 && (
        <table>
          <thead>
            <tr><th>Εκδήλωση</th><th>Πότε</th><th>Τύπος</th><th>Πλήθος</th><th>Κόστος</th><th>Κατάσταση εκδήλωσης</th></tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td><Link to={`/events/${b.event?.id}`}>{b.event?.title}</Link></td>
                <td>{b.event ? new Date(b.event.startDateTime).toLocaleString() : ''}</td>
                <td>{b.ticketType?.name}</td>
                <td>{b.numberOfTickets}</td>
                <td>{b.totalCost.toFixed(2)}€</td>
                <td><span className={`tag status-${b.event?.status}`}>{b.event?.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
