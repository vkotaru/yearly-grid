import styles from './Segmented.module.css';

/** A row of mutually exclusive buttons. Options are [value, label] or [value, label, tooltip]. */
export default function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: [T, string, string?][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map(([v, text, tip]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          title={tip}
          className={value === v ? styles.on : undefined}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
