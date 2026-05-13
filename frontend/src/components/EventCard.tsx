import { Link } from 'react-router-dom';
import type { Event } from '../lib/types';

export function EventCard({ event }: { event: Event }) {
  const minPrice = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((t) => t.price))
    : 0;
  const totalAvailable = event.ticketTypes.reduce((acc, t) => acc + t.available, 0);
  const coverPhoto = event.photos[0];

  return (
    <Link to={`/events/${event.id}`} className="card event-card" style={{ color: 'inherit' }}>
      {coverPhoto ? (
        <img className="cover" src={`/uploads/${coverPhoto.filename}`} alt={event.title} />
      ) : (
        <div className="cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          (no photo)
        </div>
      )}
      <h3>{event.title}</h3>
      <div className="muted">
        {new Date(event.startDateTime).toLocaleString()}<br />
        {event.venue}, {event.city}
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        {event.categories.map((c) => <span key={c.id} className="tag">{c.name}</span>)}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
        <span className={`tag status-${event.status}`}>{event.status}</span>
        {event.status === 'PUBLISHED' && (
          <span style={{ float: 'right', fontWeight: 600 }}>
            from {minPrice.toFixed(2)}€
            {totalAvailable === 0 && <span style={{ marginLeft: '0.5rem', color: 'var(--danger)' }}>sold out</span>}
          </span>
        )}
      </div>
    </Link>
  );
}
