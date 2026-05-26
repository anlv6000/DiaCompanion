import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { login, registerPatient, registerDoctor } from '../api/AuthApi';
import './medical.css';

// ─── Field definitions ────────────────────────────────────────────────────────

const PATIENT_FIELDS = [
  { name: 'fullName',    label: 'Full name',        type: 'text',     required: true,  autocomplete: 'name' },
  { name: 'email',       label: 'Email address',    type: 'email',    required: true,  autocomplete: 'email' },
  { name: 'password',   label: 'Password',          type: 'password', required: true,  autocomplete: 'new-password',
    hint: 'Minimum 8 characters' },
  { name: 'phoneNumber', label: 'Phone number',     type: 'tel',      required: true,  autocomplete: 'tel' },
  { name: 'gender',      label: 'Gender',           type: 'select',   required: true,
    options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other / prefer not to say' }] },
  { name: 'dob',         label: 'Date of birth',   type: 'date',     required: true,  autocomplete: 'bday' },
];

const DOCTOR_FIELDS = [
  { name: 'fullName',      label: 'Full name',       type: 'text',     required: true, autocomplete: 'name',
    hint: 'As it appears on your medical license' },
  { name: 'email',         label: 'Email address',  type: 'email',    required: true, autocomplete: 'email',
    hint: 'Use your institutional email' },
  { name: 'password',     label: 'Password',         type: 'password', required: true, autocomplete: 'new-password',
    hint: 'Minimum 8 characters' },
  { name: 'phoneNumber',   label: 'Phone number',   type: 'tel',      required: true, autocomplete: 'tel' },
  { name: 'gender',        label: 'Gender',          type: 'select',   required: true,
    options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }] },
  { name: 'dob',           label: 'Date of birth',  type: 'date',     required: true, autocomplete: 'bday' },
  { name: 'specialty',     label: 'Medical specialty', type: 'text',  required: true,
    hint: 'e.g. Endocrinology, Internal Medicine' },
  { name: 'licenseNumber', label: 'License number', type: 'text',     required: true,
    hint: 'Your official medical practice license number' },
  { name: 'department',    label: 'Department',      type: 'text',     required: true },
  { name: 'hospital',      label: 'Hospital / Clinic', type: 'text',  required: true },
];

const EMPTY_VALUES = {
  fullName: '', email: '', password: '', phoneNumber: '',
  gender: '', dob: '', specialty: '', licenseNumber: '', department: '', hospital: '',
};

// ─── Field component ──────────────────────────────────────────────────────────

function FormField({ field, value, onChange }) {
  const id = `field-${field.name}`;
  if (field.type === 'select') {
    return (
      <div className="dc-field">
        <label className="dc-label" htmlFor={id}>{field.label}
          {field.required && <span className="dc-required" aria-label="required"> *</span>}
        </label>
        <select
          id={id}
          name={field.name}
          value={value || ''}
          onChange={onChange}
          required={field.required}
          className="dc-input dc-select"
        >
          <option value="">Select an option</option>
          {field.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {field.hint && <p className="dc-hint">{field.hint}</p>}
      </div>
    );
  }
  return (
    <div className="dc-field">
      <label className="dc-label" htmlFor={id}>{field.label}
        {field.required && <span className="dc-required" aria-label="required"> *</span>}
      </label>
      <input
        id={id}
        name={field.name}
        type={field.type}
        value={value || ''}
        onChange={onChange}
        required={field.required}
        autoComplete={field.autocomplete}
        className="dc-input"
      />
      {field.hint && <p className="dc-hint">{field.hint}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthPage({ role }) {
  const isPatient = role === 'patient';
  const location  = useLocation();

  const [view,         setView]         = useState(location.state?.defaultView || 'login');
  const [values,       setValues]       = useState(EMPTY_VALUES);
  const [message,      setMessage]      = useState(null);
  const [msgType,      setMsgType]      = useState('info');   // 'success' | 'error' | 'info'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fields = isPatient ? PATIENT_FIELDS : DOCTOR_FIELDS;

  useEffect(() => {
    setMessage(null);
    setValues(EMPTY_VALUES);
  }, [view]);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
  }

  function togglePassword() {
    setShowPassword(prev => !prev);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (view === 'login') {
        const authData = await login({ email: values.email, password: values.password });
        localStorage.setItem('diaCompanionToken', authData.accessToken || '');
        setMessage('Login successful. Redirecting to your dashboard…');
        setMsgType('success');
      } else {
        const payload = {
          fullName:    values.fullName,
          email:       values.email,
          password:    values.password,
          phoneNumber: values.phoneNumber,
          gender:      values.gender,
          dob:         values.dob,
          ...(!isPatient && {
            specialty:     values.specialty,
            licenseNumber: values.licenseNumber,
            department:    values.department,
            hospital:      values.hospital,
          }),
        };
        await (isPatient ? registerPatient : registerDoctor)(payload);
        setMessage('Account created successfully. You can now log in.');
        setMsgType('success');
        setView('login');
      }
    } catch (err) {
      setMessage(err.message || 'An error occurred. Please try again.');
      setMsgType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDoctor  = !isPatient;
  const pageTitle = isPatient ? 'Patient sign-in' : 'Clinician sign-in';
  const backPath  = isPatient ? '/patient' : '/doctor';
  const backLabel = isPatient ? 'Patient portal' : 'Clinician portal';

  return (
    <div className="dc-root dc-root--auth">
      <header className="dc-header">
        <div className="dc-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#0A6E8A"/>
            <path d="M14 7v14M7 14h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="dc-logo-text">DiaCompanion</span>
        </div>
        <div className="dc-header-nav">
          <Link to={backPath} className="dc-back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {backLabel}
          </Link>
          <Link to="/" className="dc-back-link">Home</Link>
        </div>
      </header>

      <main className="dc-auth-main">
        <div className={`dc-auth-card ${isDoctor ? 'dc-auth-card--doctor' : ''}`}>

          {/* Card header */}
          <div className="dc-auth-header">
            <div className={`dc-auth-role-badge ${isDoctor ? 'dc-auth-role-badge--doctor' : ''}`}>
              {isPatient ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="5" y="2" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M7 11v2.5a1 1 0 002 0V11" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 5.5v2M7 6.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              )}
              {isPatient ? 'Patient' : 'Clinician'}
            </div>
            <h1 className="dc-auth-title">{pageTitle}</h1>
            <p className="dc-auth-subtitle">
              {isPatient
                ? 'Access your personal health records and complication history.'
                : 'Access your clinical dashboard and patient management tools.'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="dc-tab-group" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'login'}
              className={`dc-tab ${view === 'login' ? 'dc-tab--active' : ''}`}
              onClick={() => setView('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'register'}
              className={`dc-tab ${view === 'register' ? 'dc-tab--active' : ''}`}
              onClick={() => setView('register')}
            >
              Create account
            </button>
          </div>

          {/* Form */}
          <form className="dc-form" onSubmit={handleSubmit} noValidate>
            {view === 'register' && fields.map(field => (
              field.name === 'password' ? (
                <div key="password" className="dc-field">
                  <label className="dc-label" htmlFor="field-password">
                    Password <span className="dc-required" aria-label="required">*</span>
                  </label>
                  <div className="dc-password-wrap">
                    <input
                      id="field-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={values.password}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      className="dc-input dc-input--password"
                    />
                    <button
                      type="button"
                      className="dc-password-toggle"
                      onClick={togglePassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.3"/>
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.3"/>
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="dc-hint">Minimum 8 characters</p>
                </div>
              ) : (
                <FormField key={field.name} field={field} value={values[field.name]} onChange={handleChange} />
              )
            ))}

            {view === 'login' && (
              <>
                <div className="dc-field">
                  <label className="dc-label" htmlFor="login-email">
                    Email address <span className="dc-required" aria-label="required">*</span>
                  </label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    className="dc-input"
                    placeholder="you@hospital.vn"
                  />
                </div>
                <div className="dc-field">
                  <div className="dc-label-row">
                    <label className="dc-label" htmlFor="login-password">
                      Password <span className="dc-required" aria-label="required">*</span>
                    </label>
                    <button type="button" className="dc-forgot-link">Forgot password?</button>
                  </div>
                  <div className="dc-password-wrap">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={values.password}
                      onChange={handleChange}
                      required
                      autoComplete="current-password"
                      className="dc-input dc-input--password"
                    />
                    <button
                      type="button"
                      className="dc-password-toggle"
                      onClick={togglePassword}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.3"/>
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" strokeWidth="1.3"/>
                          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Alert message */}
            {message && (
              <div
                className={`dc-alert dc-alert--${msgType}`}
                role={msgType === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  {msgType === 'success' ? (
                    <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  ) : msgType === 'error' ? (
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  ) : (
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
                  )}
                </svg>
                {message}
              </div>
            )}

            <button
              type="submit"
              className={`dc-submit-btn ${isDoctor ? 'dc-submit-btn--doctor' : ''}`}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="dc-spinner" aria-hidden="true"/>
                  Processing…
                </>
              ) : view === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Security note */}
          <div className="dc-auth-security">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1.5L2 3.5v4c0 2.9 1.93 5.62 4.5 6.45C9.07 13.12 11 10.4 11 7.5v-4L6.5 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            </svg>
            <span>Secured with TLS 1.3 encryption. Your credentials are never stored in plain text.</span>
          </div>

          {/* Registration note for doctors */}
          {isDoctor && view === 'register' && (
            <div className="dc-auth-notice" role="note">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Clinician accounts require administrator approval before access is granted. You will receive an email once your credentials have been verified.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
