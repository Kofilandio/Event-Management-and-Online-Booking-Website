import { Link } from 'react-router-dom';
import type { Event } from '../lib/types';

export function EventCard({ event }: { event: Event }) {
  const minPrice = event.ticketTypes.length
    ? Math.min(...event.ticketTypes.map((t) => t.price))
    : 0;
  const totalAvailable = event.ticketTypes.reduce((acc, t) => acc + t.available, 0);
  const coverPhoto = event.photos[0];
  const start = new Date(event.startDateTime);

  const dateLabel = start.toLocaleDateString('el-GR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeLabel = start.toLocaleTimeString('el-GR', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Link to={`/events/${event.id}`} className="event-card">
      {coverPhoto ? (
        <img className="cover" src={`/uploads/${coverPhoto.filename}`} alt={event.title} />
      ) : (
        <div className="cover" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-faded)', fontSize: '0.85rem',
        }}>
          Χωρίς φωτογραφία
        </div>
      )}
      <h3>{event.title}</h3>
      <div className="meta">
        {dateLabel} · {timeLabel}<br />
        {event.venue}, {event.city}
      </div>
      <div className="cats">
        {event.categories.slice(0, 2).map((c) => <span key={c.id} className="tag">{c.name}</span>)}
        <span className={`tag status-${event.status}`}>{event.status}</span>
      </div>
      <div className="stub">
        {event.status === 'PUBLISHED' ? (
          <span className="price">
            <small>από</small>{minPrice.toFixed(2)}€
          </span>
        ) : (
          <span className="price" style={{ color: 'var(--ink-faded)' }}>
            <small>{event.status}</small>
          </span>
        )}
        {event.status === 'PUBLISHED' && totalAvailable === 0 && (
          <span className="sold-out">Εξαντλήθηκε</span>
        )}
        {event.status === 'PUBLISHED' && totalAvailable > 0 && (
          <span className="avail">{totalAvailable} διαθέσιμα</span>
        )}
      </div>
    </Link>
  );
}
