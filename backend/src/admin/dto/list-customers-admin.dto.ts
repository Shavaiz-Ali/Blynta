import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from './list-query.dto';

export class ListCustomersAdminDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  paddleSubscriptionStatus?: string;
}
