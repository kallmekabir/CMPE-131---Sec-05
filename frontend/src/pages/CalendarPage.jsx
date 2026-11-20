// Calendar — Alpha version: your upcoming joined/hosted events grouped by day (agenda view).
// The full day/week/month grid from SFDS Figure 2 is planned for the Final release.
import { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { ErrorBanner, PageHeader, Skeleton } from '../components/Common';
import EventListItem from '../components/EventListItem';
import { formatDate } from '../utils/format';

export default function CalendarPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMyEvents().then(setData).catch(setError);
  }, []);

  // Merge attending + hosting, remove duplicates, sort by start, group by date.
  const groups = useMemo(() => {
    if (!data) return [];
    const byId = new Map();
    [...data.attending, ...data.organizing].forEach((e) => byId.set(e.id, e));
    const sorted = [...byId.values()].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const map = new Map();
    sorted.forEach((e) => {
      const key = formatDate(e.startsAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.entries()];
  }, [data]);

  return (
    <div>
      <PageHeader title="Calendar" />
      <p className="muted small">Your upcoming events. A full month view is coming in the next release.</p>
      <ErrorBanner error={error} />
      {!data && !error && [1, 2].map((i) => <Skeleton key={i} height={72} style={{ marginBottom: 12 }} />)}
      {data && groups.length === 0 && <p className="card center">Nothing on your calendar yet — join an event from Home.</p>}
      {groups.map(([day, events]) => (
        <section key={day} className="agenda-day">
          <h3>{new Date(events[0].startsAt).toLocaleDateString([], { weekday: 'long' })} · {day}</h3>
          <ul className="list">
            {events.map((e) => (
              <EventListItem key={e.id} event={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
