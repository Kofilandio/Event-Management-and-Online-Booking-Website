import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(username, password);
      navigate(user.role === 'ADMIN' ? '/admin/users' : '/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container narrow">
      <div className="card">
        <h2>Σύνδεση</h2>
        <form onSubmit={submit}>
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          <div style={{ height: 8 }} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <div style={{ height: 12 }} />
          <button type="submit" disabled={busy}>{busy ? 'Σύνδεση…' : 'Σύνδεση'}</button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Δεν έχετε λογαριασμό; <Link to="/register">Εγγραφή</Link>
        </p>
      </div>
    </div>
  );
}
