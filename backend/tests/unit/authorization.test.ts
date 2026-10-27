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

  it('forbids a participant even when ids match', () => {
    expect(() => assertCanManageEvent({ userId: 'org-1', role: 'PARTICIPANT' }, event)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
