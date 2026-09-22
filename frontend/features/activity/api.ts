import { axiosClient } from '@/config/axiosClient';
import type {
  ActivityStats,
  ListActivitiesOptions,
  ListActivitiesResult,
} from './types';

export async function fetchActivities(
  options: ListActivitiesOptions = {}
): Promise<ListActivitiesResult> {
  const { data } = await axiosClient.get<ListActivitiesResult>(
    '/activities',
    { params: options }
  );
  return data;
}

export async function fetchActivityStats(): Promise<ActivityStats> {
  const { data } = await axiosClient.get<ActivityStats>('/activities/stats');
  return data;
}
