import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type TimeFilter = 'week' | 'month' | 'year' | 'total';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: ['week', 'month', 'year', 'total'], default: 'total' })
  @IsOptional()
  @IsEnum(['week', 'month', 'year', 'total'], { message: 'filter must be one of week, month, year, total' })
  filter?: TimeFilter = 'total';

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
