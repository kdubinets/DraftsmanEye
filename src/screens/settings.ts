/** Settings screen: user-facing toggles and progress reset. */
import { getSettings, updateSetting } from '../storage/settings';
import { resetStoredProgress } from '../storage/progress';
import { pageShell, actionButton } from '../render/components';
import type { AppState } from '../app/state';

export function mountSettingsScreen(
  root: HTMLElement,
  onNavigate: (next: AppState) => void,
): () => void {
  const settings = getSettings();

  const heading = document.createElement('h1');
  heading.className = 'settings-heading';
  heading.textContent = 'Settings';

  const togglesSection = document.createElement('section');
  togglesSection.className = 'settings-section';

  const togglesHeading = document.createElement('h2');
  togglesHeading.textContent = 'Drawing input';
  togglesSection.append(
    togglesHeading,
    settingToggle(
      'allow-touch',
      'Allow touch drawing',
      'Off by default; Apple Pencil or mouse gives more precise feedback.',
      settings.allowTouchDrawing,
      (v) => updateSetting('allowTouchDrawing', v),
    ),
    settingToggle(
      'pressure-width',
      'Vary stroke width by pressure',
      'Shows stylus pressure as stroke thickness. No effect with mouse.',
      settings.visualizePressureWidth,
      (v) => updateSetting('visualizePressureWidth', v),
    ),
    settingToggle(
      'speed-color',
      'Vary stroke colour by speed',
      'Slow strokes appear warm; fast strokes appear cool.',
      settings.visualizeSpeedColor,
      (v) => updateSetting('visualizeSpeedColor', v),
    ),
  );

  const dangerSection = document.createElement('section');
  dangerSection.className = 'settings-section';

  const dangerHeading = document.createElement('h2');
  dangerHeading.textContent = 'Progress';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'settings-reset-btn';
  resetBtn.textContent = 'Reset all progress';
  resetBtn.addEventListener('click', () => {
    if (!confirm('Delete all stored progress? This cannot be undone.')) return;
    resetStoredProgress();
  });

  const resetNote = document.createElement('p');
  resetNote.className = 'settings-note';
  resetNote.textContent = 'Clears scores and attempt history for all drills.';

  dangerSection.append(dangerHeading, resetNote, resetBtn);

  const backBtn = actionButton('Back to list', () => onNavigate({ screen: 'list' }));

  root.append(pageShell(heading, togglesSection, dangerSection, backBtn));
  return () => {};
}

function settingToggle(
  id: string,
  label: string,
  description: string,
  initialValue: boolean,
  onChange: (value: boolean) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.className = 'settings-label';
  labelEl.textContent = label;

  const desc = document.createElement('p');
  desc.className = 'settings-note';
  desc.textContent = description;

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = id;
  toggle.className = 'settings-toggle';
  toggle.checked = initialValue;
  toggle.addEventListener('change', () => onChange(toggle.checked));

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'settings-label-group';
  labelWrapper.append(labelEl, desc);

  row.append(labelWrapper, toggle);
  return row;
}
