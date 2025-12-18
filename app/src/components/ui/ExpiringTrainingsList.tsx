import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStethoscope,
  faKitMedical,
  faCalendarDay,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ExpiringTraining } from '../../shared/types';

type ExpiringTrainingsListProps = {
  trainings: ExpiringTraining[];
  onTrainingClick: (training: ExpiringTraining) => void;
};

const typeIcons: Record<string, IconDefinition> = {
  'care-visit': faStethoscope,
  'emergency-training': faKitMedical,
  custom: faCalendarDay,
};

const typeLabels: Record<string, string> = {
  'care-visit': 'Pflegevisite',
  'emergency-training': 'Notfallschulung',
  custom: 'Schulung',
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getUrgencyClass = (daysUntilExpiry: number): string => {
  if (daysUntilExpiry <= 7) return 'urgent';
  if (daysUntilExpiry <= 30) return 'warning';
  return 'normal';
};

const ExpiringTrainingsList = ({
  trainings,
  onTrainingClick,
}: ExpiringTrainingsListProps) => {
  if (trainings.length === 0) {
    return (
      <div className="expiring-trainings-container">
        <div className="empty">Keine ablaufenden Schulungen.</div>
      </div>
    );
  }

  return (
    <div className="expiring-trainings-container">
      <div className="expiring-trainings-list">
        {trainings.map((training) => {
          const urgency = getUrgencyClass(training.daysUntilExpiry);
          const icon = typeIcons[training.type] || faCalendarDay;
          const label = typeLabels[training.type] || training.title;

          return (
            <button
              key={training.id}
              className={`expiring-training-item ${urgency}`}
              onClick={() => onTrainingClick(training)}
            >
              <div className={`expiring-training-icon ${urgency}`}>
                {urgency === 'urgent' ? (
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                ) : (
                  <FontAwesomeIcon icon={icon} />
                )}
              </div>
              <div className="expiring-training-content">
                <div className="expiring-training-header">
                  <span className="expiring-training-type">{label}</span>
                  <span className={`expiring-training-days ${urgency}`}>
                    {training.daysUntilExpiry === 0
                      ? 'Heute'
                      : training.daysUntilExpiry === 1
                        ? 'Morgen'
                        : `${training.daysUntilExpiry} Tage`}
                  </span>
                </div>
                <div className="expiring-training-employee">{training.employeeName}</div>
                <div className="expiring-training-date muted">
                  Ablauf: {formatDate(training.expiresAt)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExpiringTrainingsList;
