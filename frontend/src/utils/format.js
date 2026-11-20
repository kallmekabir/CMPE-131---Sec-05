// Date/time helpers. PRD 4.3: dates are mm-dd-yyyy; times follow the user's region (shown as h:mm AM/PM).

const pad = (n) => String(n).padStart(2, '0');

/** "2026-11-20T02:00:00Z" → "11-19-2026" (in the viewer's local time zone) */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
}

/** → "6:00 PM" */
export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** → "Thu 11-19-2026 · 6:00 PM – 8:00 PM" */
export function formatWhen(startsAt, endsAt) {
  if (!startsAt) return '';
  const day = new Date(startsAt).toLocaleDateString([], { weekday: 'short' });
  const end = endsAt ? ` – ${formatTime(endsAt)}` : '';
  return `${day} ${formatDate(startsAt)} · ${formatTime(startsAt)}${end}`;
}

/** Values for <input type="date"> / <input type="time"> from an ISO string (local time). */
export function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function toTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-11-19" + "18:00" (local) → ISO string in UTC the backend accepts. Returns null if incomplete/invalid. */
export function combineDateTime(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "music, Hiking ,  " → ["music", "hiking"] */
export function splitList(text) {
  return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

/** Short text for capacity, e.g. "3 spots left", "Full · waitlist open", "Unlimited spots". */
export function spotsLabel(event) {
  if (event.capacity === null || event.capacity === undefined) return `${event.joinedCount} going · no limit`;
  if (event.spotsLeft > 0) return `${event.spotsLeft} of ${event.capacity} spots left`;
  return event.waitlistEnabled ? 'Full · waitlist open' : 'Full';
}
