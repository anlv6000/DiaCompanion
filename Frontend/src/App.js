import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PatientLanding from './pages/PatientLanding';
import DoctorLanding from './pages/DoctorLanding';
import AuthPage from './pages/AuthPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<HomePage />} />
        <Route path="/patient"      element={<PatientLanding />} />
        <Route path="/doctor"       element={<DoctorLanding />} />
        <Route path="/patient/auth" element={<AuthPage role="patient" />} />
        <Route path="/doctor/auth"  element={<AuthPage role="doctor" />} />
        <Route path="*"             element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
