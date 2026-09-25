import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

export class UpdateUserAdminDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @IsNotEmpty({ message: 'A reason is required for administrative user updates' })
  @IsString()
  reason: string;
}
