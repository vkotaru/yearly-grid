import { useEffect, useRef } from 'react';
import { ACCENT_COLORS, ACCENTS, EVENT_FILTERS, FONT_KEYS, FONTS, type Settings, type TextSize, type Theme } from '../lib/settings';
import Segmented from './Segmented';
import styles from './SettingsPanel.module.css';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const THEMES: [Theme, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
const SIZES: [TextSize, string][] = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];

export default function SettingsPanel({ settings, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or a click outside (the gear button handles its own toggle).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!ref.current?.contains(target) && !target.closest('[data-settings-toggle]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.panel} role="dialog" aria-label="Settings">
      <section>
        <h2>Theme</h2>
        <Segmented label="Theme" value={settings.theme} options={THEMES} onChange={(theme) => onChange({ theme })} />
      </section>

      <section>
        <h2>Accent colour</h2>
        <div className={styles.swatches} role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={settings.accent === a}
              aria-label={a}
              title={a[0].toUpperCase() + a.slice(1)}
              style={{ background: ACCENT_COLORS[a][0] }}
              className={`${styles.swatch} ${settings.accent === a ? styles.on : ''}`}
              onClick={() => onChange({ accent: a })}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Font</h2>
        <div className={styles.fonts} role="radiogroup" aria-label="Font">
          {FONT_KEYS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={settings.font === f}
              className={settings.font === f ? styles.on : undefined}
              style={{ fontFamily: FONTS[f].stack }}
              onClick={() => onChange({ font: f })}
            >
              {FONTS[f].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Text size</h2>
        <Segmented label="Text size" value={settings.textSize} options={SIZES} onChange={(textSize) => onChange({ textSize })} />
      </section>

      <section>
        <h2>Show on the grid</h2>
        <div className={styles.options} role="radiogroup" aria-label="Show on the grid">
          {EVENT_FILTERS.map(({ value: v, title, hint }) => (
            <label key={v} className={styles.option}>
              <input
                type="radio"
                name="eventFilter"
                checked={settings.eventFilter === v}
                onChange={() => onChange({ eventFilter: v })}
              />
              <span>
                <strong>{title}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
