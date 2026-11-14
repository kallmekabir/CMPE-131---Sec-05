// Map — campus map with upcoming events (FR-04) and optional "my location" (FR-06).
// Alpha uses a free Google Maps embed (no API key). If it fails, the list + Directions links still work.
import { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { ErrorBanner, Skeleton } from '../components/Common';
import EventListItem from '../components/EventListItem';
import { NavigateIcon } from '../components/Icons';

const CAMPUS = 'San Jose State University, 1 Washington Square, San Jose, CA 95192';
const embedUrl = (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;

export default function MapPage() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [mapQuery, setMapQuery] = useState(CAMPUS);
  const [mapLabel, setMapLabel] = useState('SJSU campus');
  const [locMessage, setLocMessage] = useState(null);

  useEffect(() => {
    api
      .listEvents({ limit: 50, includePassed: true })
      .then((page) => setEvents(page.items))
      .catch(setError);
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
  }, [events, search]);

  function showOnMap(event) {
    setMapQuery(`${event.location}, San Jose, CA`);
    setMapLabel(event.title);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Only asks for location when the user taps the button; the page works fine if they say no.
  function showMyLocation() {
    if (!navigator.geolocation) {
      setLocMessage('Location is not supported on this device.');
      return;
    }
    setLocMessage('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapQuery(`${latitude.toFixed(4)},${longitude.toFixed(4)}`);
        setMapLabel('Your approximate location');
        setLocMessage(null);
      },
      () => setLocMessage('Location permission denied — you can still browse events and get directions.'),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  return (
    <div className="map-page">
      <div className="map-frame">
        <iframe title={`Map: ${mapLabel}`} src={embedUrl(mapQuery)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="map-search">
          <input
            type="search"
            placeholder="Search events or places"
            aria-label="Search events or places"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="map-toolbar">
        <span className="muted small">
          Showing: {mapLabel} ·{' '}
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
        </span>
        <button type="button" className="btn btn-small btn-secondary" onClick={showMyLocation}>
          Use my location
        </button>
      </div>
      {locMessage && <p className="muted small">{locMessage}</p>}

      <ErrorBanner error={error} />
      {!events && !error && [1, 2, 3].map((i) => <Skeleton key={i} height={72} style={{ marginBottom: 12 }} />)}
      {events && filtered.length === 0 && <p className="muted center">No events match “{search}”.</p>}

      <ul className="list">
        {filtered.map((e) => (
          <EventListItem
            key={e.id}
            event={e}
            right={
              <button type="button" className="icon-btn" onClick={() => showOnMap(e)} aria-label={`Show ${e.title} on map`}>
                <NavigateIcon />
              </button>
            }
          />
        ))}
      </ul>
    </div>
  );
}
