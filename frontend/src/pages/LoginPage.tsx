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
    <div className="auth-split">
      <aside className="auth-poster">
        <div className="stamp">Διαχείριση Εκδηλώσεων</div>
        <h2 className="display">
          Καλώς ήρθες <em>ξανά</em>.
        </h2>
        <div className="footnote">
          Συνδέσου για να διαχειριστείς τις εκδηλώσεις και τις κρατήσεις σου.
        </div>
      </aside>

      <div className="auth-form-pane">
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">Σύνδεση</div>
          <h1>Σύνδεση στον λογαριασμό σου</h1>

          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={busy}>
            {busy ? 'Σύνδεση…' : 'Σύνδεση'}
          </button>

          <p className="muted" style={{ marginTop: '1.5rem' }}>
            Δεν έχετε λογαριασμό; <Link to="/register">Εγγραφή</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
