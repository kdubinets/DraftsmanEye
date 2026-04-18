/**
 * Stores and reads per-drill progress summaries from browser local storage.
 */
export type StoredProgress = {
  [exerciseId: string]: {
    emaScore: number;
    attempts: number;
  };
};

const STORAGE_KEY = 'draftsman-eye.progress.v1';

export function getStoredProgress(): StoredProgress {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredProgress(parsed)) {
      console.error('Ignoring malformed progress payload from localStorage.');
      return {};
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse stored progress.', error);
    return {};
  }
}

function isStoredProgress(value: unknown): value is StoredProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.values(value).every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const maybeEntry = entry as { emaScore?: unknown; attempts?: unknown };
    return typeof maybeEntry.emaScore === 'number' && typeof maybeEntry.attempts === 'number';
  });
}
