import { assertCanManageEvent } from '../../src/domain/authorization';

describe('assertCanManageEvent', () => {
  const event = { organizerId: 'org-1' };

  it('allows the owning organizer', () => {
    expect(() => assertCanManageEvent({ userId: 'org-1', role: 'ORGANIZER' }, event)).not.toThrow();
  });

  it('forbids a different organizer', () => {
    expect(() => assertCanManageEvent({ userId: 'org-2', role: 'ORGANIZER' }, event)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it('allows a participant-role user who owns the event (any user can host)', () => {
    expect(() =>
      assertCanManageEvent({ userId: 'org-1', role: 'PARTICIPANT' }, event),
    ).not.toThrow();
  });

  it('forbids a participant who does not own the event', () => {
    expect(() => assertCanManageEvent({ userId: 'p-9', role: 'PARTICIPANT' }, event)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
