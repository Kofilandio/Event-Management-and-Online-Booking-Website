import { useNavigate } from 'react-router-dom';

export function WelcomePage() {
  const navigate = useNavigate();
  return (
    <section className="welcome-hero">
      <div className="hero-inner">
        <div className="deck">Πλατφόρμα εκδηλώσεων & κρατήσεων</div>
        <h1>
          Βρες και κλείσε θέσεις σε <em>εκδηλώσεις</em> κοντά σου.
        </h1>
        <p className="lede">
          Οι διοργανωτές δημοσιεύουν εκδηλώσεις, ορίζουν τύπους εισιτηρίων και
          χωρητικότητα. Οι συμμετέχοντες αναζητούν, κάνουν κράτηση και
          επικοινωνούν με τους διοργανωτές — όλα σε ένα μέρος.
        </p>
        <div className="cta-row">
          <button onClick={() => navigate('/register')}>Δημιουργία λογαριασμού</button>
          <button className="secondary" onClick={() => navigate('/login')}>Σύνδεση</button>
          <button className="secondary" onClick={() => navigate('/events')}>Δες εκδηλώσεις</button>
        </div>

        <div className="feature-grid">
          <div className="feature">
            <div className="ic"></div>
            <h4>Δημιουργία</h4>
            <p>Στήσε εκδήλωση σε λίγα βήματα: τύποι εισιτηρίων, χωρητικότητα, χάρτης και φωτογραφίες.</p>
          </div>
          <div className="feature">
            <div className="ic"></div>
            <h4>Αναζήτηση</h4>
            <p>Φίλτρα κατά κατηγορία, πόλη, ημερομηνία και τιμή, με προσωπικές προτάσεις.</p>
          </div>
          <div className="feature">
            <div className="ic"></div>
            <h4>Κράτηση</h4>
            <p>Γρήγορη κράτηση εισιτηρίου με έλεγχο διαθεσιμότητας και άμεση επικοινωνία.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
