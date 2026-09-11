import React from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
};

/** Same control, focus ring and spacing as the existing selection controls. */
export default function Checkbox({ children, className = '', inputRef, ...input }: Props) {
  return (
    <label className={`radio cd-checkbox ${className}`}>
      <input {...input} ref={inputRef} type="checkbox" />
      <span className="dot" aria-hidden="true" />
      {children && <span>{children}</span>}
    </label>
  );
}
