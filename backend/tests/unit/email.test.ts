import { isApprovedUniversityEmail, normalizeEmail } from '../../src/domain/email';

const allowed = ['sjsu.edu'];

describe('isApprovedUniversityEmail', () => {
  it.each(['student@sjsu.edu', 'STUDENT@SJSU.EDU', '  a.b+c@sjsu.edu '])('accepts %s', (email) => {
    expect(isApprovedUniversityEmail(email, allowed)).toBe(true);
  });

  it.each([
    'student@gmail.com',
    'student@sjsu.edu.evil.com',
    'student@evil-sjsu.edu',
    'student@mail.sjsu.edu',
    'not-an-email',
    '@sjsu.edu',
    'a@b@sjsu.edu',
    '',
  ])('rejects %s', (email) => {
    expect(isApprovedUniversityEmail(email, allowed)).toBe(false);
  });

  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Foo@SJSU.edu ')).toBe('foo@sjsu.edu');
  });
});
