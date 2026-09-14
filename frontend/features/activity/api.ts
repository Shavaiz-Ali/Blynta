import { axiosClient } from '@/config/axiosClient';
import type {
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
