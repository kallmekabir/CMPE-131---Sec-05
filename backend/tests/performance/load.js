import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const VUS = Number(__ENV.VUS || 100);
const DURATION = __ENV.DURATION || '60s';
const PASSWORD = 'Load-Test-Password-1';

http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = {
  scenarios: {
    mixed: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:list}': ['p(95)<2000'],
    'http_req_duration{name:detail}': ['p(95)<2000'],
    'http_req_duration{name:join}': ['p(95)<2000'],
    'http_req_duration{name:pass}': ['p(95)<2000'],
    'http_req_duration{name:participation}': ['p(95)<2000'],
  },
};

let token = null;
const json = { 'Content-Type': 'application/json' };

function login() {
  const email = `load.user${(__VU - 1) % Number(__ENV.USERS || 300)}@sjsu.edu`;
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ universityEmail: email, password: PASSWORD }),
    { headers: json, tags: { name: 'login' } },
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  return res.json('data.accessToken');
}

export default function () {
  if (!token) token = login();
  const headers = { Authorization: `Bearer ${token}`, ...json };

  const page = 1 + Math.floor(Math.random() * 20);
  const list = http.get(`${BASE}/api/events?limit=20&page=${page}`, {
    headers,
    tags: { name: 'list' },
  });
  check(list, { 'list ok': (r) => r.status === 200 });
  const items = list.json('data.items') || [];
  if (items.length === 0) return;

  const event = items[Math.floor(Math.random() * items.length)];
  check(http.get(`${BASE}/api/events/${event.id}`, { headers, tags: { name: 'detail' } }), {
    'detail ok': (r) => r.status === 200,
  });

  const action = Math.random() < 0.5 ? 'join' : 'pass';
  const target = items[Math.floor(Math.random() * items.length)];
  const res = http.post(`${BASE}/api/events/${target.id}/${action}`, null, {
    headers,
    tags: { name: action },
  });
  check(res, { [`${action} ok`]: (r) => r.status === 200 || r.status === 409 });

  check(
    http.get(`${BASE}/api/users/me/participation`, { headers, tags: { name: 'participation' } }),
    {
      'participation ok': (r) => r.status === 200,
    },
  );
  sleep(0.2);
}
