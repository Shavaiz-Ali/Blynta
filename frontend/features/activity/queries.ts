import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchActivities, fetchActivityStats } from './api';
import type { ListActivitiesOptions } from './types';

export const activityKeys = {
  all: ['activities'] as const,
  lists: () => [...activityKeys.all, 'list'] as const,
  list: (options: ListActivitiesOptions) =>
    [...activityKeys.lists(), options] as const,
  stats: () => [...activityKeys.all, 'stats'] as const,
};

export function useActivities(options: ListActivitiesOptions = {}) {
  return useQuery({
    queryKey: activityKeys.list(options),
    queryFn: () => fetchActivities(options),
    staleTime: 15_000,
    // Keep the previous page visible while the next one loads so paging
    // never flashes the empty / loading state.
    placeholderData: keepPreviousData,
  });
}

export function useActivityStats() {
  return useQuery({
    queryKey: activityKeys.stats(),
    queryFn: fetchActivityStats,
    staleTime: 15_000,
  });
}
