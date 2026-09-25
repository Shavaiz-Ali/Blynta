import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ListQueryDto } from './list-query.dto';
import { UserPlan, UserRole } from '../../users/schemas/user.schema';

export class ListUsersAdminDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(UserPlan)
  plan?: UserPlan;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
