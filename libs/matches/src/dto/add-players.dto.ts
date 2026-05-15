import { IsArray, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, Min, Max, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Team } from '../entities/match-player.entity.js';

export class PlayerDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiProperty({ enum: ['A', 'B'] })
  @IsEnum(['A', 'B'])
  team: Team;

  @ApiProperty({ minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  slot: number;

  @ApiProperty({ required: false, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  position?: string;
}

export class AddPlayersDto {
  @ApiProperty({ type: [PlayerDto], minItems: 1, maxItems: 8 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PlayerDto)
  players: PlayerDto[];
}
