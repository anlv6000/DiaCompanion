import { Link } from 'react-router-dom';
import './medical.css';

export default function PatientLanding() {
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
          <div className="dc-landing-icon dc-landing-icon--patient" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 36c0-7.18 5.82-13 13-13s13 5.82 13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="dc-landing-label">Patient Portal</p>
            <h1 className="dc-landing-title">Your health, tracked and explained</h1>
            <p className="dc-landing-subtitle">
              Access your diabetes complication records, follow-up schedules, and AI-assisted
              retinal screening results — securely shared by your physician.
            </p>
          </div>
        </div>

        <div className="dc-landing-actions">
          <Link to="/patient/auth" className="dc-primary-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 7h6M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Login to my records
          </Link>
          <Link to="/patient/auth" className="dc-secondary-btn" state={{ defaultView: 'register' }}>
            Create new account
          </Link>
        </div>

        <div className="dc-info-grid">
          <div className="dc-info-card">
            <h2 className="dc-info-title">What you can view</h2>
            <ul className="dc-info-list">
              <li>Examination history and clinical indicators (HbA1c, glucose, BMI)</li>
              <li>Complication status across 5 domains with color-coded risk levels</li>
              <li>AI retinal screening results confirmed by your physician</li>
              <li>Follow-up reminders and next examination dates</li>
            </ul>
          </div>
          <div className="dc-info-card dc-info-card--security">
            <div className="dc-info-security-header">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2L3 5v5c0 3.87 2.57 7.49 6 8.93C12.43 17.49 15 13.87 15 10V5L9 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M6.5 9l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="dc-info-title">Your data is protected</h2>
            </div>
            <ul className="dc-info-list">
              <li>All records are encrypted at rest and in transit (TLS 1.3)</li>
              <li>Only your assigned physician can enter or modify clinical data</li>
              <li>You have the right to request full data export at any time</li>
              <li>Compliant with GDPR and Vietnamese healthcare data regulations</li>
            </ul>
          </div>
        </div>

        <div className="dc-contact-note" role="note">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5.5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          If you have not yet received an account from your hospital, please contact your physician or clinic reception.
        </div>
      </main>

      <footer className="dc-footer">
        <p className="dc-footer-text">
          DiaCompanion &copy; {new Date().getFullYear()} &middot; Patient data access is read-only
        </p>
      </footer>
    </div>
  );
}
