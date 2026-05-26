import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PatientLanding from './pages/PatientLanding';
import DoctorLanding from './pages/DoctorLanding';
import NotFoundPage from './pages/NotFoundPage';

// ── HomePage ───────────────────────────────────────────────────────────────
describe('HomePage', () => {
  test('renders DiaCompanion brand name', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getAllByText(/diacompanion/i).length).toBeGreaterThan(0);
  });

  test('renders Patient Portal link', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /patient/i })).toBeInTheDocument();
  });

  test('renders Clinician Dashboard link', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /clinician/i })).toBeInTheDocument();
  });
});

// ── PatientLanding ─────────────────────────────────────────────────────────
describe('PatientLanding', () => {
  test('renders Patient Portal heading', () => {
    render(<MemoryRouter><PatientLanding /></MemoryRouter>);
    expect(screen.getByText(/patient portal/i)).toBeInTheDocument();
  });

  test('renders login link', () => {
    render(<MemoryRouter><PatientLanding /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /login to my records/i })).toBeInTheDocument();
  });
});

// ── DoctorLanding ──────────────────────────────────────────────────────────
describe('DoctorLanding', () => {
  test('renders Clinician Portal heading', () => {
    render(<MemoryRouter><DoctorLanding /></MemoryRouter>);
    expect(screen.getByText(/clinician portal/i)).toBeInTheDocument();
  });

  test('renders clinical dashboard link', () => {
    render(<MemoryRouter><DoctorLanding /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /access clinical dashboard/i })).toBeInTheDocument();
  });

  test('renders AI disclaimer notice', () => {
    render(<MemoryRouter><DoctorLanding /></MemoryRouter>);
    expect(screen.getByText(/screening aid only/i)).toBeInTheDocument();
  });
});

// ── NotFoundPage ───────────────────────────────────────────────────────────
describe('NotFoundPage', () => {
  test('renders 404 status', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  test('renders go to home link', () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /go to home/i })).toBeInTheDocument();
  });
});
