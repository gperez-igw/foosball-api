import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { MatchType } from '../entities/match.entity.js';

export class CreateMatchDto {
  @ApiPropertyOptional({ enum: ['1v1', '2v2', '4v4'], default: '2v2' })
  @IsOptional()
  @IsEnum(['1v1', '2v2', '4v4'], { message: 'matchType must be one of 1v1, 2v2, 4v4' })
  matchType?: MatchType = '2v2';
}
