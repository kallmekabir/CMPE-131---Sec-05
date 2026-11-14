// One row in an event list (My Events, Map, Calendar). Clicking it opens the event details.
import { Link } from 'react-router-dom';
import { formatWhen } from '../utils/format';
import { StatusBadge } from './Common';

export default function EventListItem({ event, right }) {
  return (
    <li className="list-item">
      <Link to={`/events/${event.id}`} className="list-item-link">
        <div className="list-item-date" aria-hidden="true">
          <span>{new Date(event.startsAt).toLocaleDateString([], { month: 'short' })}</span>
          <strong>{new Date(event.startsAt).getDate()}</strong>
        </div>
        <div className="list-item-text">
          <strong className="list-item-title">{event.title}</strong>
          <span className="muted">{formatWhen(event.startsAt, event.endsAt)}</span>
          <span className="muted">{event.location}</span>
        </div>
        <StatusBadge event={event} />
      </Link>
      {right}
    </li>
  );
}
