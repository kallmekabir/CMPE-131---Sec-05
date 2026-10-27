import { StandardCalendarAdapter } from '../../src/adapters/calendar/CalendarAdapter';
import { GoogleMapsLinkAdapter } from '../../src/adapters/maps/MapAdapter';
import { AppLinkSharingAdapter } from '../../src/adapters/sharing/SharingAdapter';

describe('adapters', () => {
  it('encodes the location in map and navigation links', async () => {
    const links = await new GoogleMapsLinkAdapter().getLinks('MLK Library & Café');
    expect(links.mapUrl).toContain('MLK%20Library%20%26%20Caf%C3%A9');
    expect(links.navigationUrl).toContain('destination=');
  });

  it('formats calendar data with escaping and a default one-hour duration', async () => {
    const handoff = await new StandardCalendarAdapter().create({
      id: 'e1',
      title: 'Mixer; fun, games',
      description: 'Line1\nLine2',
      startsAt: new Date('2030-01-01T10:00:00Z'),
      endsAt: null,
      location: 'Union',
    });
    expect(handoff.ics).toContain('DTSTART:20300101T100000Z');
    expect(handoff.ics).toContain('DTEND:20300101T110000Z');
    expect(handoff.ics).toContain('SUMMARY:Mixer\\; fun\\, games');
    expect(handoff.ics).toContain('DESCRIPTION:Line1\\nLine2');
    expect(handoff.googleCalendarUrl).toContain('dates=20300101T100000Z%2F20300101T110000Z');
  });

  it('builds share URLs without double slashes', async () => {
    const links = await new AppLinkSharingAdapter('https://app.example/').createLinks('abc');
    expect(links).toEqual({
      url: 'https://app.example/events/abc',
      deepLink: 'spartin://events/abc',
    });
  });
});
