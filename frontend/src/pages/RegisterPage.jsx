import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ErrorBanner, FormField } from '../components/Common';

const empty = { name: '', universityEmail: '', password: '', confirm: '', major: '' };

// Client-side checks give instant feedback; the server checks everything again (NFR-01).
function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter your name.';
  if (!/^[^\s@]+@sjsu\.edu$/i.test(form.universityEmail.trim()))
    errors.universityEmail = 'Use your @sjsu.edu email address.';
  if (form.password.length < 10) errors.password = 'Password must be at least 10 characters.';
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match.';
  return errors;
}

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        universityEmail: form.universityEmail.trim(),
        password: form.password,
        major: form.major.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setError('Account created! Check your SJSU inbox for a verification link, then log in.');
      } else if (err.status === 409) {
        setErrors({ universityEmail: 'An account with this email already exists. Try logging in.' });
      } else {
        setErrors(err.fields || {});
        setError(err.message);
      }
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
      </div>
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h2>Create your account</h2>
        <ErrorBanner error={error} />
        <FormField label="Full name" name="name" autoComplete="name" value={form.name} onChange={update} error={errors.name} />
        <FormField
          label="SJSU email"
          name="universityEmail"
          type="email"
          autoComplete="email"
          placeholder="you@sjsu.edu"
          value={form.universityEmail}
          onChange={update}
          error={errors.universityEmail}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
          value={form.password}
          onChange={update}
          error={errors.password}
        />
        <FormField
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={update}
          error={errors.confirm}
        />
        <FormField
          label="Major (optional)"
          name="major"
          placeholder="e.g. Computer Engineering"
          value={form.major}
          onChange={update}
          error={errors.major}
        />
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="center muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
