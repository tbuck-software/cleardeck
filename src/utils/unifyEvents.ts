import type {
  UpcomingEvent,
  ExpiringTraining,
  BirthdayAnniversary,
  UnifiedEvent,
  UnifiedEventType,
} from '../shared/types';

const getUrgencyFromDays = (days: number): 'normal' | 'warning' | 'urgent' => {
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'warning';
  return 'normal';
};

export const unifyEvents = (
  upcomingEvents: UpcomingEvent[],
  expiringTrainings: ExpiringTraining[],
  birthdaysAnniversaries: BirthdayAnniversary[],
  hiddenEventTypes: UnifiedEventType[],
): UnifiedEvent[] => {
  const unified: UnifiedEvent[] = [];

  // Convert upcoming events
  for (const event of upcomingEvents) {
    if (hiddenEventTypes.includes(event.type)) continue;
    unified.push({
      id: `event-${event.id}`,
      employeeId: event.employeeId ?? 0,
      employeeName: event.employeeName,
      type: event.type,
      date: event.eventDate,
      title: event.title,
      subtitle: event.details ?? undefined,
    });
  }

  // Convert expiring trainings to certificate-expiry events
  for (const training of expiringTrainings) {
    if (hiddenEventTypes.includes('certificate-expiry')) continue;
    unified.push({
      id: `training-${training.id}`,
      employeeId: training.employeeId,
      employeeName: training.employeeName,
      type: 'certificate-expiry',
      date: training.expiresAt,
      title: training.title,
      subtitle: `Ablauf: ${new Date(training.expiresAt).toLocaleDateString('de-DE')}`,
      urgency: getUrgencyFromDays(training.daysUntilExpiry),
    });
  }

  // Convert birthdays and anniversaries
  for (const item of birthdaysAnniversaries) {
    const eventType: UnifiedEventType = item.type === 'birthday' ? 'birthday' : 'anniversary';
    if (hiddenEventTypes.includes(eventType)) continue;

    const subtitle =
      item.type === 'birthday'
        ? `${item.age}. Geburtstag`
        : `${item.years}-jähriges Dienstjubiläum`;

    unified.push({
      id: `${item.type}-${item.employeeId}-${item.date}`,
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      type: eventType,
      date: item.date,
      title: item.type === 'birthday' ? 'Geburtstag' : 'Jubiläum',
      subtitle,
    });
  }

  // Sort by date
  unified.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return unified;
};
