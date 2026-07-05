import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Booking } from '../lib/types';

export function EventBookingsPage() {
  const { id } = useParams();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Booking[]>(`/events/${id}/bookings`)
      .then(setBookings)
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="container">
      <h2><Link to="/my-events">← Οι εκδηλώσεις μου</Link> / Κρατήσεις</h2>
      {error && <div className="error">{error}</div>}
      {bookings === null && <p className="muted">Φορτώνεται…</p>}
      {bookings && bookings.length === 0 && <p className="muted">Δεν υπάρχουν κρατήσεις.</p>}
      {bookings && bookings.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>BookingID</th><th>Συμμετέχων</th><th>Τύπος εισιτηρίου</th>
              <th>Πλήθος</th><th>Κόστος</th><th>Πότε</th><th>Κατάσταση</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>B{b.id}</td>
                <td>{b.attendee?.firstName} {b.attendee?.lastName}<br/><span className="muted">{b.attendee?.email}</span></td>
                <td>{b.ticketType?.name}</td>
                <td>{b.numberOfTickets}</td>
                <td>{b.totalCost.toFixed(2)}€</td>
                <td>{new Date(b.bookedAt).toLocaleString()}</td>
                <td><span className={`tag status-${b.status}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
