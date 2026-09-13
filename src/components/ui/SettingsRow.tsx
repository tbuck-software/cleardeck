import React from 'react';

type SettingsRowProps = {
  title: string;
  note?: string;
  disabled?: boolean;
  onClick: () => void;
};

const SettingsRow = ({ title, note, disabled, onClick }: SettingsRowProps) => (
  <button type="button" className="cd-item" disabled={disabled} onClick={onClick}>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {note && <div className="cd-muted-13">{note}</div>}
    </div>
    <span className="cd-arrow">→</span>
  </button>
);

export default SettingsRow;
