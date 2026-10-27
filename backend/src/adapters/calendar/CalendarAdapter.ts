export interface CalendarEventInput {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string;
}

export interface CalendarHandoff {
  googleCalendarUrl: string;
  ics: string;
}

export interface CalendarAdapter {
  create(event: CalendarEventInput): Promise<CalendarHandoff>;
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const icsEscape = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export class StandardCalendarAdapter implements CalendarAdapter {
  async create(event: CalendarEventInput): Promise<CalendarHandoff> {
    const end = event.endsAt ?? new Date(event.startsAt.getTime() + DEFAULT_DURATION_MS);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      details: event.description,
      location: event.location,
      dates: `${stamp(event.startsAt)}/${stamp(end)}`,
    });
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SpartIN//Events//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@spartin`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(event.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${icsEscape(event.title)}`,
      `DESCRIPTION:${icsEscape(event.description)}`,
      `LOCATION:${icsEscape(event.location)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return { googleCalendarUrl: `https://calendar.google.com/calendar/render?${params}`, ics };
  }
}
