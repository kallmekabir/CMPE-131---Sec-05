// Verify email — the link in the verification email lands here: /verify-email?token=...
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../api';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'working' : 'invalid'); // working | done | invalid
  const [message, setMessage] = useState('');
  const started = useRef(false); // tokens are single-use; don't spend it twice (React StrictMode runs effects twice in dev)

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .verifyEmail(token)
      .then(() => setState('done'))
      .catch((err) => {
        setMessage(err.message);
        setState('invalid');
      });
  }, [token]);

  return (
    <div className="center-screen">
      <div className="card center" style={{ maxWidth: 360 }}>
        {state === 'working' && <p role="status">Verifying your email…</p>}
        {state === 'done' && (
          <>
            <h2>Email verified</h2>
            <p className="muted">You can now log in to SpartIN.</p>
            <Link to="/login" className="btn btn-primary">Log in</Link>
          </>
        )}
        {state === 'invalid' && (
          <>
            <h2>Link not valid</h2>
            <p className="muted">{message || 'This verification link is missing, expired or already used.'}</p>
            <Link to="/login">Back to log in</Link>
          </>
        )}
      </div>
    </div>
  );
}
