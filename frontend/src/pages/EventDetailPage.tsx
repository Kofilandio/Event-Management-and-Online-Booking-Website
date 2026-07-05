import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Event } from '../lib/types';
import { useAuth } from '../hooks/useAuth';
import { EventMap } from '../components/EventMap';

export function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketTypeId, setTicketTypeId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [msgStatus, setMsgStatus] = useState<string | null>(null);

  function load() {
    api<Event>(`/events/${id}`)
      .then((e) => {
        setEvent(e);
        if (e.ticketTypes.length && ticketTypeId == null) setTicketTypeId(e.ticketTypes[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event'));
  }

  useEffect(() => { load(); }, [id]);

  async function confirmBooking() {
    if (ticketTypeId == null) return;
    setBusy(true); setBookingError(null);
    try {
      await api(`/events/${id}/bookings`, {
        method: 'POST',
        body: { ticketTypeId, numberOfTickets: qty },
      });
      setBookingSuccess('Η κράτηση καταχωρήθηκε!');
      setShowConfirm(false);
      load();
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : 'Booking failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !event.organizer) return;
    setMsgStatus(null);
    try {
      await api('/messages', {
        method: 'POST',
        body: {
          receiverId: event.organizer.id,
          subject: messageSubject || `About: ${event.title}`,
          body: messageBody,
          relatedEventId: event.id,
        },
      });
      setMessageBody(''); setMessageSubject('');
      setMsgStatus('Το μήνυμα στάλθηκε.');
    } catch (err) {
      setMsgStatus(err instanceof ApiError ? err.message : 'Send failed');
    }
  }

  if (error) return <div className="container"><div className="card error">{error}</div></div>;
  if (!event) return <div className="container">Loading…</div>;

  const isOrganizer = user?.id === event.organizerId;
  const canBook = user && user.role !== 'ADMIN' && !isOrganizer && event.status === 'PUBLISHED';
  const selectedTt = event.ticketTypes.find((t) => t.id === ticketTypeId);
  const totalCost = selectedTt ? selectedTt.price * qty : 0;

  return (
    <div className="container">
      <div className="card">
        <div className="row between">
          <h1 style={{ margin: 0 }}>{event.title}</h1>
          <span className={`tag status-${event.status}`}>{event.status}</span>
        </div>
        <div className="muted">{event.eventType}</div>
        <div style={{ marginTop: '0.5rem' }}>
          {event.categories.map((c) => <span key={c.id} className="tag">{c.name}</span>)}
        </div>

        {event.photos.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', marginTop: '1rem' }}>
            {event.photos.map((p) => (
              <img key={p.id} src={`/uploads/${p.filename}`} alt={event.title}
                style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 6 }} />
            ))}
          </div>
        )}

        <p style={{ marginTop: '1rem' }}>{event.description}</p>

        <div className="grid two" style={{ marginTop: '1rem' }}>
          <div>
            <h4>Πληροφορίες</h4>
            <p><strong>Πότε:</strong> {new Date(event.startDateTime).toLocaleString()} → {new Date(event.endDateTime).toLocaleString()}</p>
            <p><strong>Πού:</strong> {event.venue}, {event.address}, {event.city}, {event.country}</p>
            <p><strong>Διοργανωτής:</strong> {event.organizer?.firstName} {event.organizer?.lastName} ({event.organizer?.username})</p>
            <p><strong>Χωρητικότητα:</strong> {event.capacity}</p>
          </div>
          <div>
            <h4>Τύποι Εισιτηρίων</h4>
            <table>
              <thead><tr><th>Τύπος</th><th>Τιμή</th><th>Διαθέσιμα</th></tr></thead>
              <tbody>
                {event.ticketTypes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.price.toFixed(2)}€</td>
                    <td>{t.available}/{t.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {event.latitude != null && event.longitude != null && (
          <>
            <h4>Τοποθεσία</h4>
            <EventMap lat={event.latitude} lon={event.longitude} label={`${event.venue}, ${event.city}`} />
          </>
        )}

        {bookingSuccess && <div className="card" style={{ background: '#dcfce7', borderColor: '#86efac' }}>{bookingSuccess}</div>}
        {!user && event.status === 'PUBLISHED' && (
          <p className="muted">Συνδεθείτε για να κάνετε κράτηση. <a onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>Σύνδεση</a></p>
        )}

        {canBook && (
          <div className="card" style={{ background: '#f8fafc' }}>
            <h3>Κράτηση</h3>
            <div className="grid three">
              <div>
                <label>Τύπος εισιτηρίου</label>
                <select value={ticketTypeId ?? ''} onChange={(e) => setTicketTypeId(Number(e.target.value))}>
                  {event.ticketTypes.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.available === 0}>
                      {t.name} — {t.price.toFixed(2)}€ ({t.available} avail.)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Πλήθος εισιτηρίων</label>
                <input
                  type="number" min={1} max={selectedTt?.available ?? 1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
              </div>
              <div>
                <label>Σύνολο</label>
                <input value={`${totalCost.toFixed(2)}€`} readOnly />
              </div>
            </div>
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <button onClick={() => setShowConfirm(true)} disabled={!selectedTt || selectedTt.available === 0}>
                Συνέχεια
              </button>
            </div>
            {bookingError && <div className="error">{bookingError}</div>}
          </div>
        )}

        {user && !isOrganizer && (
          <div className="card" style={{ background: '#f8fafc', marginTop: '1rem' }}>
            <h4>Επικοινωνία με τον διοργανωτή</h4>
            <form onSubmit={sendMessage}>
              <label>Θέμα</label>
              <input value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} placeholder={`About: ${event.title}`} />
              <div style={{ height: 8 }} />
              <label>Μήνυμα</label>
              <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} required />
              <div className="row" style={{ marginTop: '0.5rem' }}>
                <button type="submit">Αποστολή</button>
              </div>
              {msgStatus && <div className="muted">{msgStatus}</div>}
            </form>
          </div>
        )}
      </div>

      {showConfirm && selectedTt && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Επιβεβαίωση κράτησης</h3>
            <p>Πρόκειται να κρατήσετε <strong>{qty}</strong> εισιτήρια τύπου <strong>{selectedTt.name}</strong> για την εκδήλωση <strong>{event.title}</strong>.</p>
            <p>Συνολικό κόστος: <strong>{totalCost.toFixed(2)}€</strong></p>
            <p className="muted">Η κράτηση είναι οριστική και δεν μπορεί να αναιρεθεί.</p>
            {bookingError && <div className="error">{bookingError}</div>}
            <div className="row end">
              <button className="secondary" onClick={() => setShowConfirm(false)} disabled={busy}>Άκυρο</button>
              <button onClick={confirmBooking} disabled={busy}>{busy ? '…' : 'Επιβεβαίωση'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
