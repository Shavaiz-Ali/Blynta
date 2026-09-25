import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from './list-query.dto';
import { JobStatus } from '../../jobs/schemas/job.schema';

export class ListJobsAdminDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  userId?: string;
}
