import React from 'react';

/** Native disclosure keeps occasional help accessible to mouse and keyboard users. */
export default function FieldHelp({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="cd-help cd-muted-13 cd-field-wide">
      <summary>{title}</summary>
      <div className="cd-help-content">{children}</div>
    </details>
  );
}
