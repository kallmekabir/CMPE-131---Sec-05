// Calendar — month grid of your joined/hosted events (SFDS Figure 2). Tap a day to see its events below the grid.
import { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { ErrorBanner, PageHeader, Skeleton } from '../components/Common';
import EventListItem from '../components/EventListItem';
import { toDateInput } from '../utils/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayKey = (d) => toDateInput(d.toISOString());

export default function CalendarPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(dayKey(today));

  useEffect(() => {
    api.getMyEvents().then(setData).catch(setError);
  }, []);

  // Merge attending + hosting, remove duplicates, group by local day (yyyy-mm-dd).
  const byDay = useMemo(() => {
    const map = new Map();
    if (!data) return map;
    const byId = new Map();
    [...data.attending, ...data.organizing].forEach((e) => byId.set(e.id, e));
    [...byId.values()]
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .forEach((e) => {
        const key = toDateInput(e.startsAt);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      });
    return map;
  }, [data]);

  // Leading blanks so the 1st lands on the right weekday, then one cell per day.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const selectedEvents = byDay.get(selected) || [];

  return (
    <div>
      <PageHeader title="Calendar" />
      <ErrorBanner error={error} />
      {!data && !error && <Skeleton height={280} style={{ marginBottom: 12 }} />}
      {data && (
        <>
          <div className="cal-head">
            <button type="button" className="btn btn-small btn-secondary" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <strong>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</strong>
            <button type="button" className="btn btn-small btn-secondary" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="cal-grid" role="grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-weekday" role="columnheader">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`b${i}`} />;
              const key = dayKey(d);
              const count = byDay.get(key)?.length || 0;
              const cls = ['cal-day', key === selected && 'selected', key === dayKey(today) && 'today'].filter(Boolean).join(' ');
              return (
                <button key={key} type="button" className={cls} onClick={() => setSelected(key)} aria-pressed={key === selected}
                  aria-label={`${d.toLocaleDateString([], { month: 'long', day: 'numeric' })}, ${count} event${count === 1 ? '' : 's'}`}>
                  {d.getDate()}
                  {count > 0 && <span className="cal-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <h3 className="cal-selected">{new Date(`${selected}T00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          {selectedEvents.length === 0 ? (
            <p className="card center">Nothing scheduled — join an event from Home.</p>
          ) : (
            <ul className="list">
              {selectedEvents.map((e) => (
                <EventListItem key={e.id} event={e} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
