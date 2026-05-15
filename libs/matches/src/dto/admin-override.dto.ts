import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminOverrideResultDto {
  @ApiProperty({ minimum: 0, maximum: 255 })
  @IsInt()
  @Min(0)
  @Max(255)
  scoreA: number;

  @ApiProperty({ minimum: 0, maximum: 255 })
  @IsInt()
  @Min(0)
  @Max(255)
  scoreB: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
