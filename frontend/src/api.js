// api.js — THE ONLY FILE THAT TALKS TO THE BACKEND.
// Pages call these functions (e.g. api.joinEvent(id)) instead of using fetch directly,
// so if a URL or response shape changes we only fix it here.
// Backend reference: docs/backend/API.md

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const ACCESS_KEY = 'spartin.accessToken';
const REFRESH_KEY = 'spartin.refreshToken';

/** Error thrown by every api call. `fields` holds per-input messages, e.g. { title: ['Required'] }. */
export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// ---------- token storage ----------
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function saveTokens({ accessToken, refreshToken }) {
  try {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    /* storage blocked (private mode) — user will need to log in again next visit */
  }
}
export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}
export const hasSession = () => Boolean(readStorage(ACCESS_KEY) || readStorage(REFRESH_KEY));

// AuthContext registers a function here so we can log the user out when the session dies.
let onSessionExpired = () => {};
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

// ---------- low-level request helper ----------
function toApiError(status, body) {
  const err = body && body.error;
  if (err) return new ApiError(status, err.code, err.message, (err.details && err.details.fields) || {});
  return new ApiError(status, 'UNKNOWN', `Request failed (${status}).`);
}

// Refresh tokens are single-use, so if two requests get a 401 at the same time
// they must share ONE refresh call. This variable holds that shared promise.
let refreshInFlight = null;
function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = readStorage(REFRESH_KEY);
      if (!refreshToken) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in again.');
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw toApiError(res.status, body);
      saveTokens(body.data);
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request(path, { method = 'GET', body, auth = true, retried = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = readStorage(ACCESS_KEY);
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the SpartIN server. Check your connection and try again.');
  }

  // Access token expired → refresh once, then retry the same request.
  if (res.status === 401 && auth && !retried && readStorage(REFRESH_KEY)) {
    try {
      await refreshSession();
    } catch (e) {
      clearTokens();
      onSessionExpired();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Your session expired. Please log in again.');
    }
    return request(path, { method, body, auth, retried: true });
  }
  if (res.status === 401 && auth) {
    clearTokens();
    onSessionExpired();
  }

  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) throw toApiError(res.status, json);
  return json.data;
}

const query = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// ---------- auth ----------
export async function login(universityEmail, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { universityEmail, password },
  });
  saveTokens(data);
  return data.user;
}

export const register = (form) =>
  request('/api/auth/register', { method: 'POST', auth: false, body: form });

export async function logout() {
  const refreshToken = readStorage(REFRESH_KEY);
  clearTokens();
  if (refreshToken) {
    // Best effort: tell the server to revoke the refresh token.
    await request('/api/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(() => {});
  }
}

// ---------- current user ----------
export const getMe = () => request('/api/users/me');
export const updateMe = (changes) => request('/api/users/me', { method: 'PATCH', body: changes });
export const getMyEvents = (limit = 50) => request(`/api/users/me/events${query({ limit })}`);

// ---------- events ----------
/** params: { q, tag, from, to, feed, includePassed, page, limit } → { items, page, limit, total, hasMore } */
export const listEvents = (params) => request(`/api/events${query(params)}`);
export const getEvent = (id) => request(`/api/events/${id}`);
export const createEvent = (event) => request('/api/events', { method: 'POST', body: event });
export const updateEvent = (id, changes) => request(`/api/events/${id}`, { method: 'PATCH', body: changes });
export const rescheduleEvent = (id, startsAt, endsAt) =>
  request(`/api/events/${id}/reschedule`, { method: 'POST', body: { startsAt, endsAt } });
export const deleteEvent = (id) => request(`/api/events/${id}`, { method: 'DELETE' });
export const getParticipants = (id) => request(`/api/events/${id}/participants?limit=50`);

// ---------- participation ----------
// Each returns { eventId, status: joined|waitlisted|passed|left, waitlistPosition, joinedCount, alreadyApplied, nextEvent }
export const joinEvent = (id) => request(`/api/events/${id}/join`, { method: 'POST' });
export const passEvent = (id) => request(`/api/events/${id}/pass`, { method: 'POST' });
export const leaveEvent = (id) => request(`/api/events/${id}/leave`, { method: 'POST' });

// ---------- integrations ----------
export const getNavigationLink = (id) => request(`/api/events/${id}/navigation-link`);
export const getShareLink = (id) => request(`/api/events/${id}/share-link`);
export const getCalendarLink = (id) => request(`/api/events/${id}/calendar-link`);
export const getRecommendations = (limit = 20) => request(`/api/recommendations/events${query({ limit })}`);
