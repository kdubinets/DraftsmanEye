/** App routing state. One screen at a time; navigating replaces the current screen. */
import type { ExerciseId } from '../practice/catalog';

export type AppState =
  | { screen: 'list' }
  | { screen: 'settings' }
  | { screen: 'exercise'; exerciseId: ExerciseId; source: 'direct' | 'auto' };
