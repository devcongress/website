function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const EVENT_SUBMISSIONS_ENABLED = isEnabled(
  import.meta.env.PUBLIC_EVENT_SUBMISSIONS_ENABLED,
);
