// Home — the swipe deck (PRD FR-01 / FR-03 / FR-07).
// The deck comes from GET /api/events?feed=true, which leaves out events you already joined or passed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import { ErrorBanner, Skeleton, Toast } from '../components/Common';
import { CheckIcon, InfoIcon, XIcon } from '../components/Icons';
import SwipeCard from '../components/SwipeCard';
import { greeting } from '../utils/format';

const EXIT_ANIMATION_MS = 250;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deck, setDeck] = useState([]); // deck[0] is the card on top
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exiting, setExiting] = useState(null); // 'left' | 'right' | null while a card flies away
  const [toast, setToast] = useState(null); // { message, kind }
  const skipped = useRef(new Set()); // full events we couldn't join; don't show them again this visit

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.listEvents({ feed: true, limit: 20 });
      setDeck(page.items.filter((e) => !skipped.current.has(e.id)));
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const current = deck[0];

  // Join (right) or pass (left) on the top card.
  const act = useCallback(
    async (direction) => {
      if (!current || exiting) return;
      const event = current;
      setExiting(direction);
      const call = direction === 'right' ? api.joinEvent(event.id) : api.passEvent(event.id);
      const [outcome] = await Promise.allSettled([call, wait(EXIT_ANIMATION_MS)]);

      let putBack = false;
      if (outcome.status === 'fulfilled') {
        const r = outcome.value;
        if (r.status === 'joined') setToast({ message: `You're going to “${event.title}”!`, kind: 'success' });
        else if (r.status === 'waitlisted')
          setToast({ message: `Event is full — you're #${r.waitlistPosition} on the waitlist.`, kind: 'info' });
        else setToast({ message: 'Passed. Here’s another one.', kind: 'info' });
      } else {
        const err = outcome.reason;
        if (err.code === 'EVENT_FULL' || err.code === 'EVENT_UNAVAILABLE') {
          skipped.current.add(event.id);
          setToast({ message: err.message, kind: 'error' });
        } else {
          putBack = true; // e.g. network error: keep the card so the user can retry
          setToast({ message: err.message, kind: 'error' });
        }
      }

      setExiting(null);
      if (putBack) return;
      const remaining = deck.slice(1);
      setDeck(remaining);
      if (remaining.length === 0 && hasMore) loadDeck();
    },
    [current, exiting, deck, hasMore, loadDeck],
  );

  const openDetails = useCallback(() => {
    if (current) navigate(`/events/${current.id}`);
  }, [current, navigate]);

  // Keyboard support: ← pass, → join, Enter = details (PRD 6.2 anticipated keyboard/mouse use).
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        act('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        act('left');
      } else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') {
        openDetails(); // Enter on a focused button should press that button instead
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, openDetails]);

  const firstName = (user?.displayName || user?.name || '').split(' ')[0];
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <div className="home">
      <header className="home-header">
        <p className="muted">{greeting()}</p>
        <h1>{firstName}</h1>
      </header>

      <ErrorBanner error={error} onRetry={loadDeck} />

      <section className="deck" aria-live="polite">
        {loading && deck.length === 0 && (
          <div className="swipe-card skeleton-card" aria-label="Loading events">
            <Skeleton height="55%" radius={0} />
            <div className="swipe-card-body">
              <Skeleton height={26} width="70%" />
              <Skeleton height={16} width="85%" style={{ marginTop: 12 }} />
              <Skeleton height={16} width="60%" style={{ marginTop: 8 }} />
            </div>
          </div>
        )}

        {!loading && !error && deck.length === 0 && (
          <div className="empty-deck card">
            <h2>You're all caught up!</h2>
            <p className="muted">No more events to swipe right now. Check back later or host your own.</p>
            <Link to="/events/new" className="btn btn-primary">
              Create an event
            </Link>
            <button type="button" className="btn btn-ghost" onClick={loadDeck}>
              Refresh
            </button>
          </div>
        )}

        {deck[1] && (
          <div className="swipe-card swipe-card-behind" aria-hidden="true">
            <div
              className="swipe-card-image"
              style={deck[1].imageUrl ? { backgroundImage: `url("${deck[1].imageUrl}")` } : undefined}
            />
          </div>
        )}
        {current && (
          <SwipeCard key={current.id} event={current} exiting={exiting} onSwipe={act} onOpen={openDetails} />
        )}
      </section>

      {current && (
        <div className="swipe-actions">
          <button type="button" className="round-btn round-pass" onClick={() => act('left')} aria-label="Pass on this event">
            <XIcon size={30} />
          </button>
          <button type="button" className="round-btn round-info" onClick={openDetails} aria-label="View event details">
            <InfoIcon size={24} />
          </button>
          <button type="button" className="round-btn round-join" onClick={() => act('right')} aria-label="Join this event">
            <CheckIcon size={30} />
          </button>
        </div>
      )}
      {current && <p className="center muted small">Swipe right to join, left to pass · or use ← → keys</p>}

      <div className="center">
        <Link to="/my-events" className="btn btn-secondary">
          My Events
        </Link>
      </div>

      <Toast message={toast?.message} kind={toast?.kind} onDone={clearToast} />
    </div>
  );
}
