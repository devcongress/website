export const DEVCON26_REGISTRATION_API = '/api/public/annual-conference/2026/registration';
export const DEVCON26_REGISTRATION_ACTION = 'conference_registration';

export type Devcon26RegistrationMode = 'free' | 'paid' | 'closed';

export function parseRegistrationMode(value: unknown): { mode: Devcon26RegistrationMode; waitlist: boolean } | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;

  if (!['free', 'paid', 'closed'].includes(String(candidate.mode))) return null;

  return { mode: candidate.mode as Devcon26RegistrationMode, waitlist: candidate.waitlist === true };
}
