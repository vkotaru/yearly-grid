// View preferences. Kept in localStorage (which extension pages have too) rather
// than chrome.storage: it's synchronous, so the theme applies before first paint.

import type { GridEvent } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type TextSize = 'small' | 'medium' | 'large';
/** Which events the grid shows. All-day events are always shown. */
export type EventFilter = 'all' | 'multiDay' | 'allDay';

export const EVENT_FILTERS: { value: EventFilter; short: string; title: string; hint: string }[] = [
  { value: 'all', short: 'All', title: 'Everything', hint: 'All-day and timed events' },
  { value: 'multiDay', short: 'Multi-day', title: 'All-day + multi-day', hint: 'Hides timed events that start and end on the same day' },
  { value: 'allDay', short: 'All-day', title: 'All-day only', hint: 'Hides every timed event' },
];

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

/**
 * Font choices as stacks of fonts already on the user's machine (the first
 * installed one wins), so nothing is downloaded. Stacks after modernfontstacks.com.
 */
export const FONTS = {
  system: { label: 'System', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  rounded: {
    label: 'Rounded',
    stack: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Quicksand, Comfortaa, Manjari, 'Arial Rounded MT', 'Arial Rounded MT Bold', Calibri, sans-serif",
  },
  humanist: {
    label: 'Humanist',
    stack: "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', 'Noto Sans', sans-serif",
  },
  geometric: {
    label: 'Geometric',
    stack: "Avenir, 'Avenir Next LT Pro', Montserrat, Corbel, 'URW Gothic', sans-serif",
  },
  serif: {
    label: 'Serif',
    stack: "ui-serif, 'New York', Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif",
  },
  mono: {
    label: 'Mono',
    stack: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  },
} as const;
export type Font = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as Font[];

export interface Settings {
  theme: Theme;
  accent: Accent;
  font: Font;
  textSize: TextSize;
  eventFilter: EventFilter;
  sidebarOpen: boolean;
  /** Sidebar width in px, set by dragging its edge. */
  sidebarWidth: number;
  /** Event opacity per calendar id, 0–1; calendars not listed are fully opaque. */
  calendarAlpha: Record<string, number>;
  /** Empty lanes added with a month's + button, keyed `${year}-${month}`. */
  extraLanes: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'violet',
  font: 'system',
  textSize: 'medium',
  eventFilter: 'all',
  sidebarOpen: true,
  sidebarWidth: 210,
  calendarAlpha: {},
  extraLanes: {},
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

const isRecord = (v: unknown): v is Record<string, number> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const SIDEBAR_WIDTH = { min: 160, max: 480 };
export function clampSidebarWidth(w: unknown): number {
  if (typeof w !== 'number' || !Number.isFinite(w)) return DEFAULT_SETTINGS.sidebarWidth;
  return Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, w)));
}

export const laneKey = (year: number, month: number) => `${year}-${month}`;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    // Drop values from an older version that no longer exist.
    if (!ACCENTS.includes(merged.accent)) merged.accent = DEFAULT_SETTINGS.accent;
    if (!(merged.font in FONTS)) merged.font = DEFAULT_SETTINGS.font;
    if (!(merged.textSize in TEXT_SIZES)) merged.textSize = DEFAULT_SETTINGS.textSize;
    merged.sidebarWidth = clampSidebarWidth(merged.sidebarWidth);
    if (!isRecord(merged.calendarAlpha)) merged.calendarAlpha = {};
    if (!isRecord(merged.extraLanes)) merged.extraLanes = {};
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

/** Applies theme, accent and font to <html>, where index.css reads them. */
export function applyTheme(s: Settings): void {
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  const [light, dark] = ACCENT_COLORS[s.accent];
  root.style.setProperty('--accent-light', light);
  root.style.setProperty('--accent-dark', dark);
  root.style.setProperty('--font', FONTS[s.font].stack);
}
