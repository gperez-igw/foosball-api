import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitResultDto {
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
}
