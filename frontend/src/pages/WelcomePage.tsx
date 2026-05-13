import { useNavigate } from 'react-router-dom';

export function WelcomePage() {
  const navigate = useNavigate();
  return (
    <>
      <section className="welcome-hero">
        <h1>Διαχείριση Εκδηλώσεων & Κρατήσεων</h1>
        <p>Δημιουργήστε εκδηλώσεις, ανακαλύψτε νέες και κάντε εύκολα κρατήσεις.</p>
        <button onClick={() => navigate('/register')}>Εγγραφή</button>
        <button onClick={() => navigate('/login')}>Σύνδεση</button>
      </section>
      <div className="container">
        <div className="card">
          <h2>Καλώς ήρθατε</h2>
          <p>
            Μπορείτε να συνδεθείτε ως εγγεγραμμένος χρήστης για να δημιουργήσετε εκδηλώσεις
            ή να πραγματοποιήσετε κρατήσεις, ή να πλοηγηθείτε ως επισκέπτης.
          </p>
          <button className="secondary" onClick={() => navigate('/events')}>
            Πλοήγηση εκδηλώσεων ως επισκέπτης
          </button>
        </div>
      </div>
    </>
  );
}
