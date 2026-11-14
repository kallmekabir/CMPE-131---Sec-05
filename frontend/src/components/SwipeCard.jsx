// SwipeCard — the big Tinder-style event card on the Home page (PRD FR-01).
// Drag right = join, drag left = pass, tap = open details.
// Works with mouse AND touch via "pointer events" (no extra library).
import { useEffect, useRef, useState } from 'react';
import { formatWhen, spotsLabel } from '../utils/format';
import { ClockIcon, PinIcon, UsersIcon } from './Icons';

const SWIPE_DISTANCE = 100; // px the card must travel before it counts as a swipe
const TAP_TOLERANCE = 6; // px; less movement than this is a tap

export default function SwipeCard({ event, exiting, onSwipe, onOpen }) {
  const [dx, setDx] = useState(0); // how far the card is dragged sideways
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);

  // If a swipe was cancelled (e.g. network error, card put back), snap the card back to the middle.
  useEffect(() => {
    if (!exiting) setDx(0);
  }, [exiting]);

  function handlePointerDown(e) {
    if (exiting) return;
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragging || !start.current) return;
    setDx(e.clientX - start.current.x);
  }

  function handlePointerUp(e) {
    if (!dragging || !start.current) return;
    const moved = e.clientX - start.current.x;
    const movedY = e.clientY - start.current.y;
    setDragging(false);
    start.current = null;
    if (Math.abs(moved) < TAP_TOLERANCE && Math.abs(movedY) < TAP_TOLERANCE) {
      setDx(0);
      onOpen();
    } else if (moved > SWIPE_DISTANCE) {
      onSwipe('right');
    } else if (moved < -SWIPE_DISTANCE) {
      onSwipe('left');
    } else {
      setDx(0); // not far enough: snap back
    }
  }

  // While exiting, fly the card off screen; while dragging, follow the finger.
  let offset = dx;
  if (exiting === 'right') offset = 600;
  if (exiting === 'left') offset = -600;
  const style = {
    transform: `translateX(${offset}px) rotate(${offset / 20}deg)`,
    transition: dragging ? 'none' : 'transform 0.25s ease-out',
  };
  const hint = exiting || (dx > 40 ? 'right' : dx < -40 ? 'left' : null);

  return (
    <article
      className="swipe-card"
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        setDragging(false);
        setDx(0);
      }}
      aria-label={`Event: ${event.title}`}
    >
      <div
        className="swipe-card-image"
        style={event.imageUrl ? { backgroundImage: `url("${event.imageUrl}")` } : undefined}
      >
        {!event.imageUrl && <span className="swipe-card-placeholder">{event.title.slice(0, 1)}</span>}
        {hint === 'right' && <span className="stamp stamp-join">JOIN</span>}
        {hint === 'left' && <span className="stamp stamp-pass">PASS</span>}
      </div>
      <div className="swipe-card-body">
        <h2 className="swipe-card-title">{event.title}</h2>
        <p className="meta">
          <ClockIcon /> {formatWhen(event.startsAt, event.endsAt)}
        </p>
        <p className="meta">
          <PinIcon size={18} /> {event.location}
        </p>
        <p className="meta">
          <UsersIcon /> {spotsLabel(event)}
        </p>
        {event.tags.length > 0 && (
          <div className="chips">
            {event.tags.slice(0, 4).map((t) => (
              <span key={t} className="chip">
                #{t}
              </span>
            ))}
          </div>
        )}
        <p className="tap-hint">TAP TO LEARN MORE</p>
      </div>
    </article>
  );
}
