// Event details — everything about one event plus Join / Leave / Pass, Directions, Share,
// Add to Calendar, and (for the creator) Edit / Delete / participant list.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import { ErrorBanner, PageHeader, Skeleton, StatusBadge, Toast } from '../components/Common';
import { CalendarIcon, ClockIcon, NavigateIcon, PinIcon, ShareIcon, UsersIcon } from '../components/Icons';
import { formatWhen, spotsLabel } from '../utils/format';

export default function EventDetailsPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [participants, setParticipants] = useState(null);

  const isOwner = event && user && event.organizer.id === user.id;
  const clearToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvent(await api.getEvent(eventId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  // The creator can see who joined (names only — no emails, NFR-03).
  useEffect(() => {
    if (!isOwner) return;
    api
      .getParticipants(eventId)
      .then(setParticipants)
      .catch(() => setParticipants(null));
  }, [isOwner, eventId, event?.joinedCount]);

  // Run an action, then reload the event so counts/status are fresh.
  async function run(action, successMessage) {
    setBusy(true);
    try {
      const result = await action();
      const msg = typeof successMessage === 'function' ? successMessage(result) : successMessage;
      if (msg) setToast({ message: msg, kind: 'success' });
      await load();
    } catch (err) {
      setToast({ message: err.message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const join = () =>
    run(
      () => api.joinEvent(eventId),
      (r) => (r.status === 'waitlisted' ? `You're #${r.waitlistPosition} on the waitlist.` : "You're going!"),
    );
  const leave = () => run(() => api.leaveEvent(eventId), 'You left this event.');
  const pass = () => run(() => api.passEvent(eventId), 'Passed on this event.');

  async function remove() {
    if (!window.confirm(`Delete “${event.title}”? Participants will no longer see it.`)) return;
    setBusy(true);
    try {
      await api.deleteEvent(eventId);
      navigate('/my-events', { replace: true, state: { message: 'Event deleted.' } });
    } catch (err) {
      setToast({ message: err.message, kind: 'error' });
      setBusy(false);
    }
  }

  // Directions, share and calendar links are fetched as soon as the event loads, so the buttons below can be
  // plain links. (Safari blocks new tabs/share sheets opened *after* waiting on a network request.)
  const [links, setLinks] = useState({});
  useEffect(() => {
    if (!event) return undefined;
    let cancelled = false;
    Promise.allSettled([api.getNavigationLink(eventId), api.getShareLink(eventId), api.getCalendarLink(eventId)]).then(
      ([nav, shareLink, cal]) => {
        if (cancelled) return;
        const icsUrl =
          cal.status === 'fulfilled' ? URL.createObjectURL(new Blob([cal.value.ics], { type: 'text/calendar' })) : null;
        setLinks({
          directions: nav.status === 'fulfilled' && nav.value.available ? nav.value.navigationUrl : null,
          share: shareLink.status === 'fulfilled' ? shareLink.value.url : null,
          google: cal.status === 'fulfilled' ? cal.value.googleCalendarUrl : null,
          ics: icsUrl,
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [eventId, event?.title, event?.startsAt, event?.endsAt, event?.location]);

  // Free the .ics download URL when it is replaced or the page closes.
  useEffect(() => () => links.ics && URL.revokeObjectURL(links.ics), [links.ics]);

  const unavailable = (what) => () => setToast({ message: `${what} is unavailable right now. Please try again later.`, kind: 'error' });

  // Share: use the phone's share sheet if it has one, else copy the link (FR-05).
  async function share() {
    const url = links.share;
    if (!url) return unavailable('Sharing')();
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: `Join me at ${event.title} on SpartIN`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast({ message: 'Link copied to clipboard.', kind: 'success' });
    } catch (err) {
      if (err.name === 'AbortError') return; // user closed the share sheet
      // Clipboard blocked (some browsers/iframes): show the link so it can be copied by hand.
      window.prompt('Copy this link to share the event:', url);
    }
  }

  if (loading && !event) {
    return (
      <div>
        <PageHeader title="Event" back />
        <Skeleton height={200} />
        <Skeleton height={28} width="70%" style={{ marginTop: 16 }} />
        <Skeleton height={16} style={{ marginTop: 12 }} />
        <Skeleton height={16} width="80%" style={{ marginTop: 8 }} />
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <PageHeader title="Event" back />
        <ErrorBanner error={error.status === 404 ? 'This event no longer exists.' : error} onRetry={error.status === 404 ? null : load} />
        <Link to="/" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
    );
  }

  const s = event.viewerStatus;
  const isFull = event.capacity !== null && event.spotsLeft === 0;

  return (
    <div className="details">
      <PageHeader title="Event" back right={<StatusBadge event={event} />} />

      <div
        className="details-image"
        style={event.imageUrl ? { backgroundImage: `url("${event.imageUrl}")` } : undefined}
      >
        {!event.imageUrl && <span className="swipe-card-placeholder">{event.title.slice(0, 1)}</span>}
      </div>

      <h2 className="details-title">{event.title}</h2>
      <p className="muted">Hosted by {isOwner ? 'you' : event.organizer.displayName}</p>

      <ul className="details-meta">
        <li>
          <ClockIcon /> {formatWhen(event.startsAt, event.endsAt)}
        </li>
        <li>
          <PinIcon size={18} /> {event.location}
        </li>
        <li>
          <UsersIcon /> {spotsLabel(event)}
        </li>
      </ul>

      {event.tags.length > 0 && (
        <div className="chips">
          {event.tags.map((t) => (
            <span key={t} className="chip">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Plain text only — never rendered as HTML. */}
      <p className="details-description">{event.description}</p>

      {/* Participation controls */}
      <div className="action-row">
        {s === 'joined' && (
          <button className="btn btn-danger-outline" onClick={leave} disabled={busy}>
            Leave event
          </button>
        )}
        {s === 'waitlisted' && (
          <button className="btn btn-danger-outline" onClick={leave} disabled={busy}>
            Leave waitlist (#{event.waitlistPosition})
          </button>
        )}
        {s !== 'joined' && s !== 'waitlisted' && (
          <>
            {isFull && !event.waitlistEnabled ? (
              <button className="btn btn-primary" disabled>
                Event full
              </button>
            ) : (
              <button className="btn btn-primary" onClick={join} disabled={busy}>
                {isFull ? 'Join waitlist' : 'Join event'}
              </button>
            )}
            {s !== 'passed' && !isOwner && (
              <button className="btn btn-ghost" onClick={pass} disabled={busy}>
                Pass
              </button>
            )}
          </>
        )}
      </div>

      {/* External integrations (FR-04 directions, FR-05 share, FR-08 calendar) */}
      <div className="tool-row">
        {links.directions ? (
          <a className="tool-btn" href={links.directions} target="_blank" rel="noopener noreferrer">
            <NavigateIcon /> Directions
          </a>
        ) : (
          <button className="tool-btn" onClick={unavailable('Directions')}>
            <NavigateIcon /> Directions
          </button>
        )}
        <button className="tool-btn" onClick={share}>
          <ShareIcon /> Share
        </button>
        {links.google ? (
          <a className="tool-btn" href={links.google} target="_blank" rel="noopener noreferrer">
            <CalendarIcon size={20} /> Google Cal
          </a>
        ) : (
          <button className="tool-btn" onClick={unavailable('Calendar')}>
            <CalendarIcon size={20} /> Google Cal
          </button>
        )}
        {links.ics ? (
          <a className="tool-btn" href={links.ics} download={`${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`}>
            <CalendarIcon size={20} /> Apple/.ics
          </a>
        ) : (
          <button className="tool-btn" onClick={unavailable('Calendar')}>
            <CalendarIcon size={20} /> Apple/.ics
          </button>
        )}
      </div>

      {/* Creator-only section */}
      {isOwner && (
        <section className="card owner-panel">
          <h3>Manage your event</h3>
          <div className="action-row">
            <Link to={`/events/${event.id}/edit`} className="btn btn-secondary">
              Edit / reschedule
            </Link>
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              Delete event
            </button>
          </div>
          <h4>
            Participants ({event.joinedCount}
            {event.capacity !== null ? ` / ${event.capacity}` : ''})
          </h4>
          {participants && participants.items.length === 0 && <p className="muted">No one has joined yet.</p>}
          {participants && participants.items.length > 0 && (
            <ul className="people">
              {participants.items.map((p) => (
                <li key={p.user.id}>
                  <span className="avatar-sm">{p.user.displayName.slice(0, 1).toUpperCase()}</span>
                  <span>
                    {p.user.displayName}
                    {p.user.major ? <span className="muted"> · {p.user.major}</span> : null}
                  </span>
                  <span className={`badge badge-${p.status}`}>
                    {p.status === 'waitlisted' ? `Waitlist #${p.waitlistPosition}` : 'Going'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Toast message={toast?.message} kind={toast?.kind} onDone={clearToast} />
    </div>
  );
}
