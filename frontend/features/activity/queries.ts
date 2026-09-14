import { useQuery } from '@tanstack/react-query';
import { fetchActivities } from './api';
import type { ListActivitiesOptions } from './types';

export const activityKeys = {
  all: ['activities'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (options: ListActivitiesOptions) =>
    [...activityKeys.lists(), options] as const,
};

export function useActivities(options: ListActivitiesOptions = {}) {
  return useQuery({
    queryKey: activityKeys.list(options),
    queryFn: () => fetchActivities(options),
    staleTime: 15_000,
  });
}
