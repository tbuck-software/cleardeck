import { useCallback, useState } from 'react';
import api from '../services/api';
import type { UpcomingEvent } from '../shared/types';

type UseUpcomingEventsParams = {
  handleError: (err: unknown) => void;
};

const useUpcomingEvents = ({ handleError }: UseUpcomingEventsParams) => {
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  const loadUpcomingEvents = useCallback(
    async (limit: number = 10) => {
      try {
        const events = await api.events.listUpcoming(undefined, limit);
        setUpcomingEvents(events);
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  return {
    state: {
      upcomingEvents,
    },
    actions: {
      loadUpcomingEvents,
    },
  };
};

export default useUpcomingEvents;
