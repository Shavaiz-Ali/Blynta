import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from './list-query.dto';
import {
  ActivityCategory,
  ActivityType,
} from '../../activities/schemas/activity.schema';

export class ListAuditAdminDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
