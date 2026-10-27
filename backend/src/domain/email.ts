const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isApprovedUniversityEmail(email: string, allowedDomains: string[]): boolean {
  const normalized = normalizeEmail(email);
  if (!SIMPLE_EMAIL.test(normalized)) return false;
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  return allowedDomains.includes(domain);
}
