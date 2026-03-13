import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type ModalHeaderProps = {
  icon: IconDefinition;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  danger?: boolean;
};

const ModalHeader = ({ icon, title, subtitle, onClose, danger = false }: ModalHeaderProps) => (
  <div className="modal-header">
    <div className="modal-heading">
      <div className={`modal-icon${danger ? ' danger' : ''}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div className="modal-heading-copy">
        <h3>{title}</h3>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
      </div>
    </div>
    <button
      type="button"
      className="modal-close"
      onClick={onClose}
      aria-label="Schließen"
      title="Schließen"
    >
      <FontAwesomeIcon icon={faXmark} />
    </button>
  </div>
);

export default ModalHeader;
