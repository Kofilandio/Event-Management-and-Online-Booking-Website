import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { Event } from '../lib/types';
import { EventCard } from '../components/EventCard';

export function HomePage() {
  const { user } = useAuth();
  const [recs, setRecs] = useState<Event[] | null>(null);

  useEffect(() => {
    api<Event[]>('/recommendations?n=6').then(setRecs).catch(() => setRecs([]));
  }, []);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Καλώς ήρθατε, {user?.firstName}.</h1>
        </div>
        <div className="muted">
          {new Date().toLocaleDateString('el-GR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="grid two">
        <Link to="/my-events" className="card">
          <h3 style={{ marginTop: 0 }}>Διαχείριση εκδηλώσεων</h3>
          <p className="muted">Δημιουργήστε, επεξεργαστείτε ή ακυρώστε τις εκδηλώσεις σας και δείτε τις κρατήσεις που έχουν γίνει.</p>
        </Link>
        <Link to="/events" className="card">
          <h3 style={{ marginTop: 0 }}>Πλοήγηση & αναζήτηση</h3>
          <p className="muted">Ανακαλύψτε εκδηλώσεις από άλλους διοργανωτές και κάντε κράτηση.</p>
        </Link>
      </div>

      <div className="section-rule">
        <span className="label">Προτεινόμενα για εσάς</span>
      </div>

      {recs === null && <p className="muted">Φορτώνονται…</p>}
      {recs && recs.length === 0 && (
        <p className="muted">
          Δεν υπάρχουν προτάσεις προς το παρόν. <Link to="/events">Δείτε όλες τις εκδηλώσεις</Link>.
        </p>
      )}
      {recs && recs.length > 0 && (
        <div className="grid cards">
          {recs.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
