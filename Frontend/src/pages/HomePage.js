import { Link } from 'react-router-dom';
import './medical.css';

export default function HomePage() {
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
        <nav className="dc-nav" aria-label="Main navigation">
          <a href="https://docs.diacompanion.vn" className="dc-nav-link" target="_blank" rel="noopener noreferrer">Documentation</a>
          <a href="mailto:support@diacompanion.vn" className="dc-nav-link">Support</a>
        </nav>
      </header>

      <main className="dc-home-main">
        <section className="dc-hero" aria-labelledby="hero-heading">
          <div className="dc-hero-eyebrow">
            <span className="dc-badge">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <circle cx="5" cy="5" r="4" fill="#16A34A"/>
              </svg>
              System operational
            </span>
          </div>

          <h1 id="hero-heading" className="dc-hero-title">
            Smart Diabetes &amp;<br/>Complications Tracker
          </h1>
          <p className="dc-hero-subtitle">
            A clinical decision support system for physicians and patients,
            providing AI-assisted retinal screening and longitudinal complication monitoring.
          </p>

          <div className="dc-role-grid" role="navigation" aria-label="Role selection">
            <Link to="/patient" className="dc-role-card" aria-label="Enter as patient">
              <div className="dc-role-icon dc-role-icon--patient" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="11" r="5" stroke="currentColor" strokeWidth="2"/>
                  <path d="M6 27c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="dc-role-content">
                <h2 className="dc-role-title">Patient Portal</h2>
                <p className="dc-role-desc">View your health records, complication history, and follow-up reminders.</p>
              </div>
              <svg className="dc-role-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 10h6m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <Link to="/doctor" className="dc-role-card dc-role-card--doctor" aria-label="Enter as doctor">
              <div className="dc-role-icon dc-role-icon--doctor" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="10" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M13 20v4a3 3 0 006 0v-4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M16 10v4M14 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="dc-role-content">
                <h2 className="dc-role-title">Clinician Dashboard</h2>
                <p className="dc-role-desc">Access your patient cohort, AI retinal analysis results, and risk alerts.</p>
              </div>
              <svg className="dc-role-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 10h6m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </section>

        <section className="dc-features" aria-labelledby="features-heading">
          <h2 id="features-heading" className="dc-sr-only">Key features</h2>
          <div className="dc-feature-list">
            <div className="dc-feature">
              <div className="dc-feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6v1m0 6v1M6 10h1m6 0h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dc-feature-title">AI Retinal Screening</h3>
                <p className="dc-feature-desc">EfficientNet-B4 model graded to ETDRS/ICO R0–R4 classification</p>
              </div>
            </div>
            <div className="dc-feature">
              <div className="dc-feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 10h16M2 6h16M2 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dc-feature-title">5 Complication Domains</h3>
                <p className="dc-feature-desc">Retinopathy · Nephropathy · Neuropathy · Foot · Cardiovascular</p>
              </div>
            </div>
            <div className="dc-feature">
              <div className="dc-feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="dc-feature-title">FHIR R4 Interoperability</h3>
                <p className="dc-feature-desc">Bidirectional data exchange with hospital HIS/EMR systems</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="dc-footer">
        <p className="dc-footer-text">
          DiaCompanion &copy; {new Date().getFullYear()} &middot; SET490-G22 &middot;
          <span className="dc-secure-badge" aria-label="Secure connection">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 5V4a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Secured connection
          </span>
        </p>
      </footer>
    </div>
  );
}
