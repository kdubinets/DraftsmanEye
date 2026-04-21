import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
};
vi.stubGlobal('window', { localStorage: localStorageMock });

import { _resetSettingsCache, getSettings, updateSetting } from './settings';

const STORAGE_KEY = 'draftsman-eye.settings.v1';

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  _resetSettingsCache();
});

describe('getSettings', () => {
  it('uses 2.5s auto-repeat by default', () => {
    expect(getSettings().autoRepeatDelayMs).toBe(2500);
  });

  it('accepts the off auto-repeat setting', () => {
    store[STORAGE_KEY] = JSON.stringify({ autoRepeatDelayMs: null });

    expect(getSettings().autoRepeatDelayMs).toBeNull();
  });

  it('accepts supported auto-repeat delays', () => {
    store[STORAGE_KEY] = JSON.stringify({ autoRepeatDelayMs: 4000 });

    expect(getSettings().autoRepeatDelayMs).toBe(4000);
  });

  it('rejects malformed auto-repeat delay values', () => {
    store[STORAGE_KEY] = JSON.stringify({ autoRepeatDelayMs: 3000 });

    expect(getSettings().autoRepeatDelayMs).toBe(2500);
  });

  it('returns defaults and logs for invalid JSON', () => {
    store[STORAGE_KEY] = '{{not-json';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(getSettings().autoRepeatDelayMs).toBe(2500);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});

describe('updateSetting', () => {
  it('persists an updated auto-repeat delay', () => {
    updateSetting('autoRepeatDelayMs', 1500);

    expect(JSON.parse(store[STORAGE_KEY] ?? '{}')).toMatchObject({
      autoRepeatDelayMs: 1500,
    });
  });
});
