// Profile — name, username, major, interests, skills (used for event matching, FR-09), edit form, log out.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import { ErrorBanner, FormField } from '../components/Common';
import { splitList } from '../utils/format';

const CHANGELOG = [
  { version: 'v0.1 Alpha (11-15-2026)', notes: 'Swipe to join/pass, create/edit/delete events, waitlists, My Events, map, share & calendar links.' },
];

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setForm({
      name: user.name,
      displayName: user.displayName,
      major: user.major || '',
      interests: user.interests.join(', '),
      skills: user.skills.join(', '),
    });
    setErrors({});
    setError(null);
    setEditing(true);
  }

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const found = {};
    if (!form.name.trim()) found.name = 'Name is required.';
    if (!form.displayName.trim()) found.displayName = 'Username is required.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({
        name: form.name.trim(),
        displayName: form.displayName.trim(),
        major: form.major.trim() || null,
        interests: splitList(form.interests),
        skills: splitList(form.skills),
      });
      setUser(updated);
      setEditing(false);
    } catch (err) {
      setErrors(err.fields || {});
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="profile">
      <div className="profile-head">
        <div className="avatar" aria-hidden="true">
          {(user.displayName || user.name).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1>{user.name}</h1>
          <p className="muted">@{user.displayName}</p>
          {user.major && <p className="muted small">{user.major}</p>}
        </div>
      </div>

      {!editing && (
        <>
          <dl className="profile-facts">
            <dt>Interests</dt>
            <dd>{user.interests.length ? user.interests.map((t) => <span key={t} className="chip">{t}</span>) : <span className="muted">None yet</span>}</dd>
            <dt>Skills</dt>
            <dd>{user.skills.length ? user.skills.map((t) => <span key={t} className="chip">{t}</span>) : <span className="muted">None yet</span>}</dd>
            <dt>Email (private)</dt>
            <dd className="muted">{user.universityEmail}</dd>
          </dl>
          <div className="menu">
            <button className="menu-item" onClick={startEdit}>
              Account — edit profile
            </button>
            <Link className="menu-item" to="/my-events">
              My Events
            </Link>
            <details className="menu-item">
              <summary>Changelog</summary>
              {CHANGELOG.map((c) => (
                <p key={c.version} className="small">
                  <strong>{c.version}</strong> — {c.notes}
                </p>
              ))}
            </details>
            <button className="menu-item menu-danger" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </>
      )}

      {editing && (
        <form className="form" onSubmit={save} noValidate>
          <ErrorBanner error={error} />
          <FormField label="Full name" name="name" value={form.name} onChange={update} error={errors.name} />
          <FormField label="Username" name="displayName" value={form.displayName} onChange={update} error={errors.displayName} />
          <FormField label="Major" name="major" value={form.major} onChange={update} error={errors.major} />
          <FormField label="Interests" name="interests" value={form.interests} onChange={update} error={errors.interests} hint="Comma separated, e.g. music, hiking" />
          <FormField label="Skills" name="skills" value={form.skills} onChange={update} error={errors.skills} hint="Comma separated, e.g. react, photography" />
          <div className="form-actions">
            <button type="button" className="btn btn-cancel" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-create" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
