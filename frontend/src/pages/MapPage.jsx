// Map — Leaflet + OpenStreetMap with one pin per event (FR-04) and optional "you are here" (FR-06).
// Event locations are text, so pins are placed by src/utils/geocode.js (cached). Events it can't find sit at the
// campus center and say so. The list below the map and its Directions links work even if the map fails.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import { ErrorBanner, Skeleton } from '../components/Common';
import EventListItem from '../components/EventListItem';
import { NavigateIcon } from '../components/Icons';
import { CAMPUS_CENTER, geocodeAll } from '../utils/geocode';
import { formatWhen } from '../utils/format';

const MAX_PINS = 15;
const pinIcon = (cls) => L.divIcon({ className: '', html: `<span class="map-pin ${cls}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });

export default function MapPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [locMessage, setLocMessage] = useState(null);
  const [pinsLeft, setPinsLeft] = useState(0);
  const mapEl = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map()); // event id -> Leaflet marker
  const me = useRef(null);

  useEffect(() => {
    api
      .listEvents({ limit: 50 })
      .then((page) => setEvents(page.items))
      .catch(setError);
  }, []);

  // Create the map once.
  useEffect(() => {
    map.current = L.map(mapEl.current).setView(CAMPUS_CENTER, 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    const markerMap = markers.current;
    return () => {
      map.current.remove();
      map.current = null;
      markerMap.clear();
    };
  }, []);

  // Drop a pin for each event as its location is geocoded.
  useEffect(() => {
    if (!events) return undefined;
    const pinned = events.slice(0, MAX_PINS);
    let cancelled = false;
    setPinsLeft(new Set(pinned.map((e) => e.location)).size);
    geocodeAll(
      pinned.map((e) => e.location),
      (location, { coords, approximate }) => {
        if (cancelled || !map.current) return;
        pinned
          .filter((e) => e.location === location)
          .forEach((e) => {
            const popup = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = e.title;
            const when = document.createElement('div');
            when.textContent = formatWhen(e.startsAt, e.endsAt);
            const where = document.createElement('div');
            where.textContent = approximate ? `${e.location} (approximate pin)` : e.location;
            const open = document.createElement('button');
            open.type = 'button';
            open.className = 'btn btn-small btn-primary';
            open.textContent = 'View event';
            open.onclick = () => navigate(`/events/${e.id}`);
            popup.append(title, when, where, open);
            const marker = L.marker(coords, { icon: pinIcon(approximate ? 'approx' : ''), title: e.title }).bindPopup(popup).addTo(map.current);
            markers.current.set(e.id, marker);
          });
        setPinsLeft((n) => Math.max(0, n - 1));
      },
      () => cancelled,
    );
    return () => {
      cancelled = true;
    };
  }, [events, navigate]);

  const filtered = useMemo(() => {
    if (!events) return [];
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
  }, [events, search]);

  // Searching also hides pins that don't match.
  useEffect(() => {
    if (!map.current) return;
    const ids = new Set(filtered.map((e) => e.id));
    markers.current.forEach((marker, id) => {
      if (ids.has(id)) marker.addTo(map.current);
      else marker.remove();
    });
  }, [filtered, pinsLeft]);

  function showOnMap(event) {
    const marker = markers.current.get(event.id);
    if (!marker) {
      setLocMessage('Still locating that event on the map — try again in a moment.');
      return;
    }
    setLocMessage(null);
    map.current.flyTo(marker.getLatLng(), 18);
    marker.openPopup();
    mapEl.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Only asks for location when the user taps the button; the page works fine if they say no.
  function showMyLocation() {
    if (!navigator.geolocation) {
      setLocMessage('Location is not supported on this device.');
      return;
    }
    setLocMessage('Finding you…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = [coords.latitude, coords.longitude];
        me.current?.remove();
        me.current = L.marker(here, { icon: pinIcon('me'), title: 'You are here' }).addTo(map.current).bindPopup('You are here');
        map.current.flyTo(here, 17);
        setLocMessage(null);
      },
      () => setLocMessage('Location permission denied — you can still browse events and get directions.'),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  return (
    <div className="map-page">
      <div className="map-frame">
        <div ref={mapEl} className="map-canvas" role="region" aria-label="Map of upcoming events" />
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
        <span className="muted small">{pinsLeft > 0 ? 'Placing events on the map…' : 'Tap a pin for details.'}</span>
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
