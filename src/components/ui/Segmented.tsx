import React, { useId } from 'react';

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: React.ReactNode;
  /** Dimmed count shown after the label, as on the employee detail tabs. */
  count?: number;
};

type SegmentedProps<T extends string | number> = {
  options: SegmentedOption<T>[];
  value: T;
  /** NoInfer: a setState handler would otherwise widen T to its constraint. */
  onChange: NoInfer<(value: T) => void>;
  ariaLabel?: string;
  /** Stretch options to fill the row — used inside form fields. */
  fill?: boolean;
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  fill,
  wrap,
  className,
  style,
}: SegmentedProps<T>) => {
  const name = useId();
  return (
    <div
      className={`seg${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ ...(fill ? { display: 'flex' } : null), ...(wrap ? { flexWrap: 'wrap' } : null), ...style }}
    >
      {options.map((option) => (
        <label
          key={String(option.value)}
          className="seg-opt"
          style={fill ? { flex: 1, justifyContent: 'center' } : undefined}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
          {option.count !== undefined && <span style={{ opacity: 0.7 }}> {option.count}</span>}
        </label>
      ))}
    </div>
  );
};

export default Segmented;
