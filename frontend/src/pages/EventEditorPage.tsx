import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Event } from '../lib/types';

interface TicketDraft {
  id?: number;
  name: string;
  price: string;
  quantity: string;
}

export function EventEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [f, setF] = useState({
    title: '', eventType: '', venue: '', address: '', city: '', country: 'Greece',
    latitude: '', longitude: '',
    startDateTime: '', endDateTime: '',
    capacity: '', description: '',
  });
  const [categories, setCategories] = useState<string[]>(['']);
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { name: '', price: '', quantity: '' },
  ]);
  const [photos, setPhotos] = useState<{ id: number; filename: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    api<Event>(`/events/${id}`).then((e) => {
      setEventId(e.id);
      setF({
        title: e.title, eventType: e.eventType, venue: e.venue, address: e.address,
        city: e.city, country: e.country,
        latitude: e.latitude?.toString() ?? '',
        longitude: e.longitude?.toString() ?? '',
        startDateTime: e.startDateTime.slice(0, 16),
        endDateTime: e.endDateTime.slice(0, 16),
        capacity: e.capacity.toString(),
        description: e.description,
      });
      setCategories(e.categories.map((c) => c.name));
      setTickets(e.ticketTypes.map((t) => ({
        id: t.id, name: t.name, price: t.price.toString(), quantity: t.quantity.toString(),
      })));
      setPhotos(e.photos);
    }).catch((err) => setError(err.message));
  }, [id, mode]);

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF({ ...f, [key]: value });
  }
  function setCat(i: number, v: string) {
    const next = [...categories]; next[i] = v; setCategories(next);
  }
  function setTicket(i: number, key: keyof TicketDraft, v: string) {
    const next = [...tickets]; next[i] = { ...next[i], [key]: v }; setTickets(next);
  }

  function ticketCapacityHint() {
    const sum = tickets.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
    return sum;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const body = {
        ...f,
        latitude: f.latitude ? Number(f.latitude) : undefined,
        longitude: f.longitude ? Number(f.longitude) : undefined,
        startDateTime: new Date(f.startDateTime).toISOString(),
        endDateTime: new Date(f.endDateTime).toISOString(),
        capacity: Number(f.capacity),
        categories: categories.map((c) => c.trim()).filter(Boolean),
        ticketTypes: tickets.map((t) => ({
          id: t.id,
          name: t.name.trim(),
          price: Number(t.price),
          quantity: Number(t.quantity),
        })),
      };
      let saved: Event;
      if (mode === 'create') {
        saved = await api<Event>('/events', { method: 'POST', body });
      } else {
        saved = await api<Event>(`/events/${id}`, { method: 'PUT', body });
      }
      setEventId(saved.id);
      navigate('/my-events');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!eventId) {
      setError('Save the event first to upload photos.'); return;
    }
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const photo = await api<{ id: number; filename: string }>(`/events/${eventId}/photos`, {
        method: 'POST', body: fd,
      });
      setPhotos([...photos, photo]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    }
  }

  async function removePhoto(photoId: number) {
    if (!eventId) return;
    try {
      await api(`/events/${eventId}/photos/${photoId}`, { method: 'DELETE' });
      setPhotos(photos.filter((p) => p.id !== photoId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  }

  const capacityNum = Number(f.capacity) || 0;
  const ticketSum = ticketCapacityHint();

  return (
    <div className="container">
      <h2>{mode === 'create' ? 'Νέα Εκδήλωση' : 'Επεξεργασία Εκδήλωσης'}</h2>
      <form onSubmit={submit} className="card">
        <div className="grid two">
          <div>
            <label>Τίτλος *</label>
            <input value={f.title} onChange={(e) => set('title', e.target.value)} required />
          </div>
          <div>
            <label>Τύπος (π.χ. Concert, Seminar) *</label>
            <input value={f.eventType} onChange={(e) => set('eventType', e.target.value)} required />
          </div>
          <div>
            <label>Χώρος (Venue) *</label>
            <input value={f.venue} onChange={(e) => set('venue', e.target.value)} required />
          </div>
          <div>
            <label>Διεύθυνση *</label>
            <input value={f.address} onChange={(e) => set('address', e.target.value)} required />
          </div>
          <div>
            <label>Πόλη *</label>
            <input value={f.city} onChange={(e) => set('city', e.target.value)} required />
          </div>
          <div>
            <label>Χώρα *</label>
            <input value={f.country} onChange={(e) => set('country', e.target.value)} required />
          </div>
          <div>
            <label>Latitude</label>
            <input type="number" step="any" value={f.latitude} onChange={(e) => set('latitude', e.target.value)} />
          </div>
          <div>
            <label>Longitude</label>
            <input type="number" step="any" value={f.longitude} onChange={(e) => set('longitude', e.target.value)} />
          </div>
          <div>
            <label>Έναρξη *</label>
            <input type="datetime-local" value={f.startDateTime} onChange={(e) => set('startDateTime', e.target.value)} required />
          </div>
          <div>
            <label>Λήξη *</label>
            <input type="datetime-local" value={f.endDateTime} onChange={(e) => set('endDateTime', e.target.value)} required />
          </div>
          <div>
            <label>Χωρητικότητα *</label>
            <input type="number" min={1} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} required />
          </div>
        </div>

        <label style={{ marginTop: '1rem' }}>Περιγραφή *</label>
        <textarea value={f.description} onChange={(e) => set('description', e.target.value)} required />

        <h4 style={{ marginTop: '1rem' }}>Κατηγορίες *</h4>
        {categories.map((c, i) => (
          <div className="row" key={i} style={{ marginBottom: '0.5rem' }}>
            <input value={c} onChange={(e) => setCat(i, e.target.value)} placeholder="π.χ. Music, Theatre" />
            {categories.length > 1 && (
              <button type="button" className="secondary" onClick={() => setCategories(categories.filter((_, j) => j !== i))}>Αφαίρεση</button>
            )}
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setCategories([...categories, ''])}>+ Κατηγορία</button>

        <h4 style={{ marginTop: '1rem' }}>Τύποι Εισιτηρίων *</h4>
        <div className={ticketSum > capacityNum && capacityNum > 0 ? 'error' : 'muted'} style={{ marginBottom: '0.5rem' }}>
          Σύνολο εισιτηρίων: {ticketSum} / Χωρητικότητα: {capacityNum || '—'}
          {ticketSum > capacityNum && capacityNum > 0 && ' (υπερβαίνει τη χωρητικότητα)'}
        </div>
        {tickets.map((t, i) => (
          <div className="ticket-row" key={i}>
            <div>
              <label>Όνομα</label>
              <input value={t.name} onChange={(e) => setTicket(i, 'name', e.target.value)} required />
            </div>
            <div>
              <label>Τιμή (€)</label>
              <input type="number" min="0" step="0.01" value={t.price} onChange={(e) => setTicket(i, 'price', e.target.value)} required />
            </div>
            <div>
              <label>Ποσότητα</label>
              <input type="number" min="1" value={t.quantity} onChange={(e) => setTicket(i, 'quantity', e.target.value)} required />
            </div>
            {tickets.length > 1 && (
              <button type="button" className="secondary" onClick={() => setTickets(tickets.filter((_, j) => j !== i))}>Αφαίρεση</button>
            )}
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setTickets([...tickets, { name: '', price: '', quantity: '' }])}>+ Τύπος Εισιτηρίου</button>

        {mode === 'edit' && eventId && (
          <>
            <h4 style={{ marginTop: '1rem' }}>Φωτογραφίες</h4>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))' }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <img src={`/uploads/${p.filename}`} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 6 }} />
                  <button type="button" className="danger" style={{ position: 'absolute', top: 4, right: 4, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() => removePhoto(p.id)}>×</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadPhoto(file);
              e.target.value = '';
            }} />
          </>
        )}

        {error && <div className="error">{error}</div>}
        <div className="row end" style={{ marginTop: '1rem' }}>
          <button type="button" className="secondary" onClick={() => navigate('/my-events')}>Άκυρο</button>
          <button type="submit" disabled={busy}>{busy ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
        </div>
      </form>
    </div>
  );
}
