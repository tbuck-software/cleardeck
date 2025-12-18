import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen,
  faPlus,
  faCalendarCheck,
  faStethoscope,
  faCakeCandles,
} from '@fortawesome/free-solid-svg-icons';
import type { PatientWithLatestVisit, PatientVisit } from '../../shared/types';
import QprBadge from '../ui/QprBadge';
import { formatDateDE } from '../../utils/dateFormat';

type PatientDetailProps = {
  patient: PatientWithLatestVisit;
  visits: PatientVisit[];
  onEdit: () => void;
  onAddVisit: () => void;
  onSelectVisit: (visit: PatientVisit) => void;
};

const PatientDetail = ({
  patient,
  visits,
  onEdit,
  onAddVisit,
  onSelectVisit,
}: PatientDetailProps) => {
  const handleEnterSpace = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit();
    }
  };

  return (
    <div className="stack">
      <div className="card detail-header">
        <div className="detail-main">
          <div
            role="button"
            tabIndex={0}
            className="detail-name-block"
            onClick={onEdit}
            onKeyDown={handleEnterSpace}
            title="Patient:in bearbeiten"
          >
            <div className="detail-name-content">
              <h2>{patient.name}</h2>
              <div className="note-inline">
                {patient.note && patient.note.trim().length > 0 ? (
                  <span className="note-text-inline">{patient.note}</span>
                ) : (
                  <span className="muted">Notiz hinzufuegen</span>
                )}
              </div>
            </div>
            <div className="detail-edit-icon">
              <FontAwesomeIcon icon={faPen} />
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-item" title="Geburtsdatum">
              <div className="detail-icon">
                <FontAwesomeIcon icon={faCakeCandles} />
              </div>
              <div className="detail-content">
                <span className="detail-label">Geburtsdatum</span>
                <span className="detail-value">{formatDateDE(patient.birthDate)}</span>
              </div>
            </div>

            <div className="detail-item" title="Diagnose">
              <div className="detail-icon">
                <FontAwesomeIcon icon={faStethoscope} />
              </div>
              <div className="detail-content">
                <span className="detail-label">Diagnose</span>
                <span className="detail-value">{patient.diagnosis ?? '-'}</span>
              </div>
            </div>

            <div className="detail-item" title="QPR-Status">
              <div className="detail-icon">
                <FontAwesomeIcon icon={faCalendarCheck} />
              </div>
              <div className="detail-content">
                <span className="detail-label">QPR-Status</span>
                <div className="detail-value">
                  <QprBadge rating={patient.latestQprRating ?? patient.qprStatus} />
                </div>
              </div>
            </div>

            <div className="detail-item" title="Anzahl Visiten">
              <div className="detail-icon">
                <FontAwesomeIcon icon={faCalendarCheck} />
              </div>
              <div className="detail-content">
                <span className="detail-label">Visiten gesamt</span>
                <span className="detail-value">{patient.visitCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="form-header">
          <h3>Visiten / Assessments</h3>
          <div className="detail-actions">
            <button className="primary" onClick={onAddVisit}>
              <FontAwesomeIcon icon={faPlus} /> Neue Visite
            </button>
          </div>
        </div>
        <div className="timeline">
          {visits.map((visit) => (
            <button
              className="timeline-item"
              key={visit.id}
              onClick={() => onSelectVisit(visit)}
            >
              <div className="timeline-dot event-dot event-visit">
                <FontAwesomeIcon icon={faCalendarCheck} />
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timeline-title">
                    <QprBadge rating={visit.qprRating} showLabel />
                  </span>
                  <span className="timeline-date">{formatDateDE(visit.visitDate)}</span>
                </div>
                {visit.comment && <div className="timeline-note muted">{visit.comment}</div>}
              </div>
            </button>
          ))}
          {visits.length === 0 && <div className="empty">Keine Visiten vorhanden.</div>}
        </div>
      </div>
    </div>
  );
};

export default PatientDetail;
