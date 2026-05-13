import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Event, Paginated } from '../lib/types';
import { EventCard } from '../components/EventCard';

export function BrowseEventsPage() {
  const [filters, setFilters] = useState({
    title: '', description: '', category: '', city: '',
    dateFrom: '', dateTo: '', priceMin: '', priceMax: '',
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Event> | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<string[]>('/events/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '12');
    for (const [k, v] of Object.entries(applied)) {
      if (v) params.set(k, v);
    }
    api<Paginated<Event>>(`/events?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [applied, page]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  }
  function resetFilters() {
    const empty = { title: '', description: '', category: '', city: '',
      dateFrom: '', dateTo: '', priceMin: '', priceMax: '' };
    setFilters(empty); setApplied(empty); setPage(1);
  }

  function set<K extends keyof typeof filters>(k: K, v: string) {
    setFilters({ ...filters, [k]: v });
  }

  return (
    <div className="container">
      <h2>Εκδηλώσεις</h2>
      <form className="card" onSubmit={applyFilters}>
        <div className="grid three">
          <div>
            <label>Τίτλος</label>
            <input value={filters.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label>Κατηγορία</label>
            <select value={filters.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">— Όλες —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Πόλη</label>
            <input value={filters.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div>
            <label>Περιγραφή (κείμενο)</label>
            <input value={filters.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <label>Από</label>
            <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
          </div>
          <div>
            <label>Έως</label>
            <input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
          </div>
          <div>
            <label>Τιμή από (€)</label>
            <input type="number" min="0" value={filters.priceMin} onChange={(e) => set('priceMin', e.target.value)} />
          </div>
          <div>
            <label>Τιμή έως (€)</label>
            <input type="number" min="0" value={filters.priceMax} onChange={(e) => set('priceMax', e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button type="submit">Αναζήτηση</button>
          <button type="button" className="secondary" onClick={resetFilters}>Καθαρισμός</button>
        </div>
      </form>

      {loading && <p className="muted">Φόρτωση…</p>}
      {data && data.items.length === 0 && <p className="muted">Δεν βρέθηκαν εκδηλώσεις.</p>}
      {data && data.items.length > 0 && (
        <>
          <p className="muted">{data.total} εκδηλώσεις</p>
          <div className="grid cards">
            {data.items.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
          {data.totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>‹ Προηγ.</button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={p === page ? 'active' : 'secondary'} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
              <button disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>Επόμ. ›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
