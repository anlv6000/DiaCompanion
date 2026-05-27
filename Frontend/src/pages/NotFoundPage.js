import { Link } from 'react-router-dom';
import './medical.css';

export default function NotFoundPage() {
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
      </header>

      <main className="dc-landing-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <p style={{ fontSize: 64, fontWeight: 600, color: 'var(--dc-gray-200)', lineHeight: 1, marginBottom: 16 }}>404</p>
        <h1 className="dc-landing-title" style={{ marginBottom: 12 }}>Page not found</h1>
        <p className="dc-landing-subtitle" style={{ marginBottom: 32, maxWidth: 380 }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="dc-landing-actions">
          <Link to="/" className="dc-primary-btn">Go to home</Link>
        </div>
      </main>

      <footer className="dc-footer">
        <p className="dc-footer-text">DiaCompanion &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
