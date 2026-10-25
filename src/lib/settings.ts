// View preferences. Kept in localStorage (which extension pages have too) rather
// than chrome.storage: it's synchronous, so the theme applies before first paint.

import type { GridEvent } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type TextSize = 'small' | 'medium' | 'large';
/** Which events the grid shows. All-day events are always shown. */
export type EventFilter = 'all' | 'multiDay' | 'allDay';

/** Accent colours: [light-theme shade, dark-theme shade]. */
export const ACCENT_COLORS = {
  violet: ['#7c3aed', '#a78bfa'],
  blue: ['#2563eb', '#60a5fa'],
  teal: ['#0d9488', '#2dd4bf'],
  green: ['#16a34a', '#4ade80'],
  amber: ['#d97706', '#fbbf24'],
  rose: ['#e11d48', '#fb7185'],
} as const;
export type Accent = keyof typeof ACCENT_COLORS;
export const ACCENTS = Object.keys(ACCENT_COLORS) as Accent[];

export interface Settings {
  theme: Theme;
  accent: Accent;
  textSize: TextSize;
  eventFilter: EventFilter;
  sidebarOpen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'violet',
  textSize: 'medium',
  eventFilter: 'all',
  sidebarOpen: true,
};

/** Lane height (px) and event font size (px) for each text size. */
export const TEXT_SIZES: Record<TextSize, { lane: number; font: number }> = {
  small: { lane: 18, font: 10 },
  medium: { lane: 22, font: 11 },
  large: { lane: 28, font: 13 },
};

export function passesFilter(g: GridEvent, filter: EventFilter): boolean {
  if (filter === 'all' || g.allDay) return true;
  return filter === 'multiDay' && g.endDay > g.startDay;
}

const KEY = 'settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    // Drop values from an older version that no longer exist.
    if (!ACCENTS.includes(merged.accent)) merged.accent = DEFAULT_SETTINGS.accent;
    if (!(merged.textSize in TEXT_SIZES)) merged.textSize = DEFAULT_SETTINGS.textSize;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable — settings just won't persist.
  }
}

/** Applies theme and accent to <html>, where index.css reads them. */
export function applyTheme(s: Settings): void {
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  const [light, dark] = ACCENT_COLORS[s.accent];
  root.style.setProperty('--accent-light', light);
  root.style.setProperty('--accent-dark', dark);
}
