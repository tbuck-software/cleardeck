import React from 'react';
import Icon from './Icon';

export type BackTarget = { label: string; onBack: () => void };

const BackLink = ({ label, onBack }: BackTarget) => (
  <button type="button" className="btn btn-ghost cd-back-link" onClick={onBack}>
    <Icon name="arrowLeft" size={16} />
    <span>{label}</span>
  </button>
);

export default BackLink;
