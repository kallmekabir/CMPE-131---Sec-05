// Create Event AND Edit Event (FR-02). Same form; if the URL has an :eventId we are editing.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../AuthContext';
import { ErrorBanner, FormField, PageHeader, Skeleton } from '../components/Common';
import { combineDateTime, splitList, toDateInput, toTimeInput } from '../utils/format';

const blank = {
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  description: '',
  capacity: '',
  waitlistEnabled: false,
  imageUrl: '',
  tags: '',
};

// Turn an event from the API into form values (strings for inputs).
function toForm(e) {
  return {
    title: e.title,
    date: toDateInput(e.startsAt),
    startTime: toTimeInput(e.startsAt),
    endTime: e.endsAt ? toTimeInput(e.endsAt) : '',
    location: e.location,
    description: e.description,
    capacity: e.capacity === null ? '' : String(e.capacity),
    waitlistEnabled: e.waitlistEnabled,
    imageUrl: e.imageUrl || '',
    tags: e.tags.join(', '),
  };
}

// Turn form values into what the API expects. Returns { data, errors }.
function toPayload(f) {
  const errors = {};
  if (!f.title.trim()) errors.title = 'Give your event a title.';
  if (!f.location.trim()) errors.location = 'Where is it happening?';
  if (!f.description.trim()) errors.description = 'Add a short description.';
  if (!f.date) errors.date = 'Pick a date.';
  if (!f.startTime) errors.startTime = 'Pick a start time.';

  const startsAt = combineDateTime(f.date, f.startTime);
  const endsAt = f.endTime ? combineDateTime(f.date, f.endTime) : null;
  if (startsAt && new Date(startsAt) <= new Date()) errors.startTime = 'The event must start in the future.';
  if (startsAt && endsAt && endsAt <= startsAt) errors.endTime = 'End time must be after the start time.';

  let capacity = null;
  if (f.capacity.trim() !== '') {
    capacity = Number(f.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Use a whole number (1 or more), or leave blank for no limit.';
  }
  const imageUrl = f.imageUrl.trim();
  if (imageUrl && !/^https:\/\/\S+$/i.test(imageUrl)) errors.imageUrl = 'Image link must start with https://';

  const data = {
    title: f.title.trim(),
    description: f.description.trim(),
    location: f.location.trim(),
    startsAt,
    endsAt,
    capacity,
    waitlistEnabled: capacity === null ? false : f.waitlistEnabled,
    imageUrl: imageUrl || null,
    tags: splitList(f.tags),
  };
  return { data, errors };
}

// Server field names → our input names, so server errors show under the right input.
const serverFieldMap = { startsAt: 'startTime', endsAt: 'endTime' };

export default function EventFormPage() {
  const { eventId } = useParams();
  const editing = Boolean(eventId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  // When editing, load the event and fill the form.
  useEffect(() => {
    if (!editing) return;
    api
      .getEvent(eventId)
      .then((e) => {
        if (e.organizer.id !== user.id) {
          setError('Only the person who created this event can edit it.');
          return;
        }
        setOriginal(e);
        setForm(toForm(e));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [editing, eventId, user.id]);

  const update = (e) => {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const { data, errors: found } = toPayload(form);
    // When editing a past-dated event we only re-check the time if it was changed.
    if (editing && original && data.startsAt === new Date(original.startsAt).toISOString()) delete found.startTime;
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      let saved;
      if (!editing) {
        if (!data.imageUrl) delete data.imageUrl;
        saved = await api.createEvent(data);
      } else {
        saved = await saveEdits(data);
      }
      navigate(`/events/${saved.id}`, { replace: true });
    } catch (err) {
      const fields = {};
      Object.entries(err.fields || {}).forEach(([k, v]) => {
        fields[serverFieldMap[k] || k] = v;
      });
      setErrors(fields);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Edit = reschedule (if date/time changed) + PATCH only the fields that changed.
  async function saveEdits(data) {
    const timeChanged =
      data.startsAt !== new Date(original.startsAt).toISOString() ||
      (data.endsAt || null) !== (original.endsAt ? new Date(original.endsAt).toISOString() : null);
    let saved = original;
    if (timeChanged) saved = await api.rescheduleEvent(original.id, data.startsAt, data.endsAt);

    const changes = {};
    ['title', 'description', 'location', 'capacity', 'waitlistEnabled', 'imageUrl'].forEach((k) => {
      if ((data[k] ?? null) !== (original[k] ?? null)) changes[k] = data[k];
    });
    if (data.tags.join(',') !== original.tags.join(',')) changes.tags = data.tags;
    if (Object.keys(changes).length > 0) saved = await api.updateEvent(original.id, changes);
    return saved;
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Edit Event" back />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={48} style={{ marginBottom: 16 }} />
        ))}
      </div>
    );
  }

  if (editing && !original) {
    return (
      <div>
        <PageHeader title="Edit Event" back />
        <ErrorBanner error={error || 'Could not load this event.'} />
      </div>
    );
  }

  const noLimit = form.capacity.trim() === '';

  return (
    <div>
      <PageHeader title={editing ? 'Edit Event' : 'Create Event'} back={editing} />
      <form className="form" onSubmit={handleSubmit} noValidate>
        <ErrorBanner error={error} />
        <FormField label="Title" name="title" maxLength={120} value={form.title} onChange={update} error={errors.title} placeholder="Coffee after CMPE 131" />
        <div className="field-row">
          <FormField label="Date" name="date" type="date" value={form.date} onChange={update} error={errors.date} />
          <FormField label="Start time" name="startTime" type="time" value={form.startTime} onChange={update} error={errors.startTime} />
        </div>
        <div className="field-row">
          <FormField label="End time (optional)" name="endTime" type="time" value={form.endTime} onChange={update} error={errors.endTime} />
          <FormField
            label="Capacity"
            name="capacity"
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="No limit"
            value={form.capacity}
            onChange={update}
            error={errors.capacity}
          />
        </div>
        <label className={`toggle${noLimit ? ' disabled' : ''}`}>
          <input type="checkbox" name="waitlistEnabled" checked={form.waitlistEnabled && !noLimit} onChange={update} disabled={noLimit} />
          <span>Waitlist enabled</span>
          <small className="muted">{noLimit ? 'Set a capacity to use a waitlist.' : 'When full, new people join a waitlist.'}</small>
        </label>
        <FormField label="Location" name="location" maxLength={200} value={form.location} onChange={update} error={errors.location} placeholder="Student Union, Room 2A" />
        <FormField
          as="textarea"
          rows={4}
          label="Description"
          name="description"
          maxLength={5000}
          value={form.description}
          onChange={update}
          error={errors.description}
          placeholder="What should people expect?"
        />
        <FormField
          label="Tags (optional)"
          name="tags"
          value={form.tags}
          onChange={update}
          error={errors.tags}
          hint="Comma separated, e.g. coffee, music, study"
        />
        <FormField
          label="Image link (optional)"
          name="imageUrl"
          type="url"
          value={form.imageUrl}
          onChange={update}
          error={errors.imageUrl}
          hint="Paste an https:// image link. Photo upload is coming later."
        />
        <div className="form-actions">
          <button type="button" className="btn btn-cancel" onClick={() => navigate(-1)} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-create" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
