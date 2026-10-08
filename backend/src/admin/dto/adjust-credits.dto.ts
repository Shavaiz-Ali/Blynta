import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustCreditsDto {
  @IsNotEmpty({ message: 'Credit adjustment amount is required' })
  @Type(() => Number)
  @IsInt()
  amount: number;

  @IsNotEmpty({ message: 'Reason for credit adjustment is required' })
  @IsString()
  reason: string;

  @IsOptional()
  @IsUUID()
  operationId?: string;
}
