import { Link } from 'react-router-dom';
import './medical.css';

export default function DoctorLanding() {
  return (
    <div className="dc-root">
      <header className="dc-header">
        <div className="dc-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#0A6E8A"/>
            <path d="M14 7v14M7 14h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="dc-logo-text">DiaCompanion</span>
        </div>
        <Link to="/" className="dc-back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Home
        </Link>
      </header>

      <main className="dc-landing-main">
        <div className="dc-landing-hero">
          <div className="dc-landing-icon dc-landing-icon--doctor" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="12" y="4" width="16" height="22" rx="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 26v5a4 4 0 008 0v-5" stroke="currentColor" strokeWidth="2"/>
              <path d="M20 12v6M17 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="dc-landing-label">Clinician Portal</p>
            <h1 className="dc-landing-title">Clinical decision support for diabetes care</h1>
            <p className="dc-landing-subtitle">
              Monitor your patient cohort, review AI-assisted retinal grading, manage complication
              tracking across 5 domains, and receive automated risk alerts — all in one dashboard.
            </p>
          </div>
        </div>

        <div className="dc-landing-actions">
          <Link to="/doctor/auth" className="dc-primary-btn dc-primary-btn--doctor">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 7h6M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Access clinical dashboard
          </Link>
          <Link to="/doctor/auth" className="dc-secondary-btn" state={{ defaultView: 'register' }}>
            Register as a clinician
          </Link>
        </div>

        <div className="dc-info-grid">
          <div className="dc-info-card">
            <h2 className="dc-info-title">Dashboard capabilities</h2>
            <ul className="dc-info-list">
              <li>Patient cohort view with color-coded risk triage (green / yellow / red)</li>
              <li>AI retinal analysis — EfficientNet-B4, ETDRS/ICO R0–R4 grading</li>
              <li>Complication sub-tables: nephropathy, neuropathy, foot, cardiovascular</li>
              <li>Acute event detection: DKA, HHS, lactic acidosis alerts</li>
              <li>Longitudinal HbA1c trend charts and next-examination scheduling</li>
              <li>PDF report export per patient for referral letters</li>
            </ul>
          </div>

          <div className="dc-info-card">
            <h2 className="dc-info-title">System integration</h2>
            <ul className="dc-info-list">
              <li>FHIR R4 API — bidirectional sync with hospital HIS/EMR</li>
              <li>Push notifications for high-priority alerts</li>
              <li>Mobile data entry with offline support (React Native app)</li>
              <li>Audit logging on all clinical data changes</li>
              <li>Role-based access: doctor, patient, admin</li>
            </ul>
          </div>

          <div className="dc-info-card dc-info-card--alert">
            <div className="dc-info-security-header">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2l6 3v5c0 3.87-2.57 6.49-6 7.93C5.57 16.49 3 13.87 3 10V5l6-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M7 9l1.5 1.5L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="dc-info-title">Clinical responsibility notice</h2>
            </div>
            <p className="dc-info-notice">
              AI retinal grading is a <strong>screening aid only</strong> and does not replace
              formal ophthalmological diagnosis. All AI-generated grades require clinician
              review and confirmation before clinical action is taken.
            </p>
            <p className="dc-info-notice" style={{ marginTop: '8px' }}>
              Clinical thresholds are based on <strong>ADA Standards of Medical Care 2024</strong>
              and IDF guidelines.
            </p>
          </div>
        </div>

        <div className="dc-contact-note" role="note">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5.5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          New clinician accounts require administrator approval. Contact your hospital system administrator to activate your credentials.
        </div>
      </main>

      <footer className="dc-footer">
        <p className="dc-footer-text">
          DiaCompanion &copy; {new Date().getFullYear()} &middot; For licensed medical professionals only
        </p>
      </footer>
    </div>
  );
}
