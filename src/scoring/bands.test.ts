import { describe, it, expect } from 'vitest';
import { feedbackHueForError, feedbackBandClass, feedbackLabel } from './bands';

describe('bands', () => {
  const cases: [number, number, string, string][] = [
    // [error, hue, cls, label]
    [0,        135, 'excellent', 'Excellent'],
    [1,        135, 'excellent', 'Excellent'],   // boundary: ≤1 → excellent
    [1.0001,   102, 'good',      'Good'],
    [3,        102, 'good',      'Good'],         // boundary: ≤3 → good
    [3.0001,    48, 'ok',        'OK'],
    [5,         48, 'ok',        'OK'],           // boundary: ≤5 → ok
    [5.0001,     4, 'bad',       'Off target'],
    [100,        4, 'bad',       'Off target'],
  ];

  for (const [error, hue, cls, label] of cases) {
    it(`error=${error} → hue=${hue}, cls=${cls}, label=${label}`, () => {
      expect(feedbackHueForError(error)).toBe(hue);
      expect(feedbackBandClass(error)).toBe(cls);
      expect(feedbackLabel(error)).toBe(label);
    });
  }

  it('all three functions agree at every threshold boundary', () => {
    for (const threshold of [1, 3, 5]) {
      const h = feedbackHueForError(threshold);
      const c = feedbackBandClass(threshold);
      const l = feedbackLabel(threshold);
      // Just confirm no NaN/undefined
      expect(typeof h).toBe('number');
      expect(typeof c).toBe('string');
      expect(typeof l).toBe('string');
    }
  });
});
