import { useState } from 'react';
import { api, downloadFile } from '../lib/api';

export function AdminExportPage() {
  const [retraining, setRetraining] = useState(false);
  const [trainResult, setTrainResult] = useState<string | null>(null);

  async function retrain() {
    setRetraining(true); setTrainResult(null);
    try {
      const r = await api<{ users: number; items: number; rmseHistory: number[] }>(
        '/recommendations/retrain', { method: 'POST' },
      );
      const lastRmse = r.rmseHistory.length ? r.rmseHistory[r.rmseHistory.length - 1].toFixed(4) : 'n/a';
      setTrainResult(`OK — users: ${r.users}, items: ${r.items}, final RMSE: ${lastRmse}`);
    } catch (e: any) {
      setTrainResult('Error: ' + (e.message ?? 'unknown'));
    } finally {
      setRetraining(false);
    }
  }

  return (
    <div className="container">
      <h2>Εξαγωγή δεδομένων</h2>
      <div className="card">
        <h3>Εκδηλώσεις</h3>
        <p className="muted">Εξαγωγή όλων των εκδηλώσεων στο σύστημα.</p>
        <div className="row">
          <button onClick={() => downloadFile('/admin/export/xml', 'events.xml')}>Λήψη XML</button>
          <button onClick={() => downloadFile('/admin/export/json', 'events.json')}>Λήψη JSON</button>
        </div>
      </div>

      <div className="card">
        <h3>Σύστημα Συστάσεων</h3>
        <p className="muted">Επανεκπαίδευση του Biased Matrix Factorization μοντέλου με βάσει τα τρέχοντα δεδομένα.</p>
        <button onClick={retrain} disabled={retraining}>{retraining ? 'Εκπαίδευση…' : 'Επανεκπαίδευση'}</button>
        {trainResult && <p className="muted" style={{ marginTop: '0.5rem' }}>{trainResult}</p>}
      </div>
    </div>
  );
}
