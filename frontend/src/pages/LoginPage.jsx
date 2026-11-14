import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ErrorBanner, FormField } from '../components/Common';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goTo = location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={goTo} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your SJSU email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(goTo, { replace: true });
    } catch (err) {
      setError(
        err.code === 'EMAIL_NOT_VERIFIED'
          ? 'Please verify your SJSU email before logging in. Check your inbox for the link.'
          : err.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="brand">
        <span className="brand-logo">S</span>
        <h1>
          Spart<span>IN</span>
        </h1>
        <p className="muted">Meet other SJSU transfer students at small events.</p>
      </div>

      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h2>Log in</h2>
        <ErrorBanner error={error} />
        <FormField
          label="SJSU email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@sjsu.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="center muted">
          New to SpartIN? <Link to="/register">Create an account</Link>
        </p>
      </form>

      {import.meta.env.DEV && (
        <p className="dev-note">
          Dev seed accounts: <code>participant.dev@sjsu.edu</code> / <code>organizer.dev@sjsu.edu</code> — password{' '}
          <code>DevOnly-Password-1</code>
        </p>
      )}
    </div>
  );
}
