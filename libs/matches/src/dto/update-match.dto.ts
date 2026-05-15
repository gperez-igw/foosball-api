import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMatchDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 255 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  scoreA?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 255 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  scoreB?: number;
}
