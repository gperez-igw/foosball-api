import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { MatchType, MatchStatus } from '../entities/match.entity.js';

export class ListMatchesDto {
  @ApiPropertyOptional({ enum: ['draft', 'playing', 'awaiting_confirmation', 'confirmed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'playing', 'awaiting_confirmation', 'confirmed', 'cancelled'])
  status?: MatchStatus;

  @ApiPropertyOptional({ enum: ['1v1', '2v2', '4v4'] })
  @IsOptional()
  @IsEnum(['1v1', '2v2', '4v4'])
  matchType?: MatchType;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  createdBy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
