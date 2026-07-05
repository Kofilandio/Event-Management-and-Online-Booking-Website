import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export function RegisterPage() {
  const [f, setF] = useState({
    username: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', country: 'Greece', afm: '',
    latitude: '', longitude: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF({ ...f, [key]: value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);

    if (f.password !== f.confirmPassword) {
      setError('Passwords do not match'); return;
    }

    setBusy(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          ...f,
          latitude: f.latitude ? Number(f.latitude) : undefined,
          longitude: f.longitude ? Number(f.longitude) : undefined,
        },
      });
      setSuccess('Η εγγραφή σας υποβλήθηκε. Εκκρεμεί η έγκριση του διαχειριστή. Θα μεταφερθείτε σε λίγο.');
      setTimeout(() => navigate('/login'), 3500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError(err.message);
        else setError(err.message);
      } else setError('Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Εγγραφή</h2>
        <form onSubmit={submit}>
          <div className="grid two">
            <div>
              <label>Username *</label>
              <input value={f.username} onChange={(e) => set('username', e.target.value)} required minLength={3} />
            </div>
            <div>
              <label>ΑΦΜ *</label>
              <input value={f.afm} onChange={(e) => set('afm', e.target.value)} required />
            </div>
            <div>
              <label>Όνομα *</label>
              <input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} required />
            </div>
            <div>
              <label>Επώνυμο *</label>
              <input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} required />
            </div>
            <div>
              <label>Email *</label>
              <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required />
            </div>
            <div>
              <label>Τηλέφωνο *</label>
              <input value={f.phone} onChange={(e) => set('phone', e.target.value)} required />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
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
              <input value={f.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="e.g. 37.9838" />
            </div>
            <div>
              <label>Longitude</label>
              <input value={f.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="e.g. 23.7275" />
            </div>
            <div>
              <label>Password *</label>
              <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} required minLength={6} />
            </div>
            <div>
              <label>Confirm Password *</label>
              <input type="password" value={f.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} required />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          {success && <div className="success-msg">{success}</div>}
          <div style={{ height: 12 }} />
          <button type="submit" disabled={busy}>{busy ? 'Υποβολή…' : 'Εγγραφή'}</button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Έχετε ήδη λογαριασμό; <Link to="/login">Σύνδεση</Link>
        </p>
      </div>
    </div>
  );
}
