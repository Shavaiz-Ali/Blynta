import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { UserPlan, UserRole } from '../../users/schemas/user.schema';

export class BroadcastFilterDto {
  @IsOptional()
  @IsEnum(UserPlan)
  plan?: UserPlan;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class BroadcastNotificationDto {
  @IsNotEmpty({ message: 'Notification title is required' })
  @IsString()
  title: string;

  @IsNotEmpty({ message: 'Notification message is required' })
  @IsString()
  message: string;

  @IsNotEmpty({ message: 'Notification type is required' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => BroadcastFilterDto)
  filter?: BroadcastFilterDto;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
