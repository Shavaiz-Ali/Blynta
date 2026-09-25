import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelSubscriptionAdminDto {
  @IsOptional()
  @IsBoolean()
  immediately?: boolean = false;

  @IsNotEmpty({ message: 'Reason for subscription cancellation is required' })
  @IsString()
  reason: string;
}
