import { useCallback, useMemo, useState } from 'react';
import api from '../services/api';
import type { UpcomingEvent, UnifiedEventType } from '../shared/types';

type UseUpcomingEventsParams = {
  handleError: (err: unknown) => void;
};

const useUpcomingEvents = ({ handleError }: UseUpcomingEventsParams) => {
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [hiddenEventTypes, setHiddenEventTypes] = useState<UnifiedEventType[]>([]);

  const loadHiddenEventTypes = useCallback(async () => {
    try {
      const types = await api.settings.getHiddenEventTypes();
      setHiddenEventTypes(types as UnifiedEventType[]);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const loadUpcomingEvents = useCallback(
    async (limit = 10) => {
      try {
        const events = await api.events.listUpcoming(undefined, limit);
        setUpcomingEvents(events);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const toggleEventTypeFilter = useCallback(
    async (type: UnifiedEventType) => {
      try {
        const newHidden = hiddenEventTypes.includes(type)
          ? hiddenEventTypes.filter((t) => t !== type)
          : [...hiddenEventTypes, type];
        await api.settings.setHiddenEventTypes(newHidden);
        setHiddenEventTypes(newHidden);
      } catch (err) {
        handleError(err);
      }
    },
    [hiddenEventTypes, handleError],
  );

  const showAllEventTypes = useCallback(async () => {
    try {
      await api.settings.setHiddenEventTypes([]);
      setHiddenEventTypes([]);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const hideAllEventTypes = useCallback(async () => {
    try {
      const allTypes: UnifiedEventType[] = [
        'join',
        'leave',
        'care-visit',
        'emergency-training',
        'custom',
        'birthday',
        'anniversary',
        'certificate-expiry',
      ];
      await api.settings.setHiddenEventTypes(allTypes);
      setHiddenEventTypes(allTypes);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  // Filter events based on hidden types
  const filteredEvents = upcomingEvents.filter(
    (event) => !hiddenEventTypes.includes(event.type),
  );

  const actions = useMemo(
    () => ({
      loadUpcomingEvents,
      loadHiddenEventTypes,
      toggleEventTypeFilter,
      showAllEventTypes,
      hideAllEventTypes,
    }),
    [loadUpcomingEvents, loadHiddenEventTypes, toggleEventTypeFilter, showAllEventTypes, hideAllEventTypes],
  );

  return {
    state: {
      upcomingEvents: filteredEvents,
      allUpcomingEvents: upcomingEvents,
      hiddenEventTypes,
    },
    actions,
  };
};

export default useUpcomingEvents;
