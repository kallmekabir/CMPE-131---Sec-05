// My Events — events I'm attending (joined or waitlisted) and events I'm hosting.
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as api from '../api';
import { ErrorBanner, PageHeader, Skeleton, Toast } from '../components/Common';
import EventListItem from '../components/EventListItem';

export default function MyEventsPage() {
  const location = useLocation();
  const [tab, setTab] = useState('attending');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(location.state?.message || null);
  const clearToast = useCallback(() => setToast(null), []);

  const load = useCallback(() => {
    setError(null);
    api.getMyEvents().then(setData).catch(setError);
  }, []);
  useEffect(load, [load]);

  const list = data ? (tab === 'attending' ? data.attending : data.organizing) : [];

  return (
    <div>
      <PageHeader title="My Events" />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'attending'} className={tab === 'attending' ? 'tab active' : 'tab'} onClick={() => setTab('attending')}>
          Attending {data ? `(${data.attending.length})` : ''}
        </button>
        <button role="tab" aria-selected={tab === 'hosting'} className={tab === 'hosting' ? 'tab active' : 'tab'} onClick={() => setTab('hosting')}>
          Hosting {data ? `(${data.organizing.length})` : ''}
        </button>
      </div>

      <ErrorBanner error={error} onRetry={load} />
      {!data && !error && [1, 2, 3].map((i) => <Skeleton key={i} height={72} style={{ marginBottom: 12 }} />)}

      {data && list.length === 0 && (
        <div className="card center">
          {tab === 'attending' ? (
            <>
              <p>You haven't joined any events yet.</p>
              <Link to="/" className="btn btn-primary">
                Find events
              </Link>
            </>
          ) : (
            <>
              <p>You're not hosting any events.</p>
              <Link to="/events/new" className="btn btn-primary">
                Create an event
              </Link>
            </>
          )}
        </div>
      )}

      <ul className="list">
        {list.map((e) => (
          <EventListItem key={e.id} event={e} />
        ))}
      </ul>
      <Toast message={toast} kind="success" onDone={clearToast} />
    </div>
  );
}
