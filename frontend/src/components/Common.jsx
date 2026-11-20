// Small reusable UI pieces used by many pages.
import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { BackIcon } from './Icons';

/** Shows children only when logged in; otherwise sends the user to /login (and back here afterwards). */
export function ProtectedRoute({ children }) {
  const { user, checking, startupError } = useAuth();
  const location = useLocation();
  if (checking) return <FullPageSpinner />;
  if (!user && startupError) {
    // Saved session exists but the server is unreachable — don't pretend the user is logged out.
    return (
      <div className="center-screen">
        <div className="card center" style={{ maxWidth: 360 }}>
          <h2>Can't reach SpartIN</h2>
          <p className="muted">{startupError}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function FullPageSpinner() {
  return (
    <div className="center-screen" role="status" aria-live="polite">
      <div className="spinner" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Label + input + the error message(s) for that field. Pass `as="textarea"` for multi-line. */
export function FormField({ label, name, error, hint, as = 'input', children, ...inputProps }) {
  const Tag = as;
  const id = `field-${name}`;
  const message = Array.isArray(error) ? error.join(' ') : error;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children || (
        <Tag
          id={id}
          name={name}
          aria-invalid={message ? 'true' : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          {...inputProps}
        />
      )}
      {hint && !message && <small className="hint">{hint}</small>}
      {message && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {message}
        </small>
      )}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="banner banner-error" role="alert">
      <span>{typeof error === 'string' ? error : error.message}</span>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Grey placeholder blocks shown while data loads (PRD: skeleton loaders). */
export function Skeleton({ height = 16, width = '100%', radius = 8, style }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius, ...style }} aria-hidden="true" />;
}

/** Temporary message at the bottom of the screen. Clears itself after `duration` ms. */
export function Toast({ message, kind = 'info', onDone, duration = 2600 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, onDone, duration]);
  if (!message) return null;
  return (
    <div className={`toast toast-${kind}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function PageHeader({ title, back = false, right = null }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <BackIcon />
        </button>
      )}
      <h1>{title}</h1>
      <div className="page-header-right">{right}</div>
    </header>
  );
}

const STATUS_TEXT = {
  joined: 'Going',
  waitlisted: 'Waitlisted',
  passed: 'Passed',
  left: 'Left',
  full: 'Full',
};
export function StatusBadge({ event }) {
  const s = event.viewerStatus;
  if (!s || s === 'none') return null;
  const text = s === 'waitlisted' && event.waitlistPosition ? `Waitlist #${event.waitlistPosition}` : STATUS_TEXT[s];
  return <span className={`badge badge-${s}`}>{text}</span>;
}
