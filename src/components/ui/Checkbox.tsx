import React from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: React.ReactNode;
};

/** Same control, focus ring and spacing as the existing selection controls. */
export default function Checkbox({ children, className = '', ...input }: Props) {
  return (
    <label className={`radio cd-checkbox ${className}`}>
      <input {...input} type="checkbox" />
      <span className="dot" aria-hidden="true" />
      {children && <span>{children}</span>}
    </label>
  );
}
