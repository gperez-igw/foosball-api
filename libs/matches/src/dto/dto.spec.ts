/**
 * DTO instantiation tests — cover the class declarations so Istanbul
 * counts them as covered statements. We also do lightweight constraint
 * checks using class-validator to exercise any default/decorator paths.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateMatchDto } from './create-match.dto';
import { UpdateMatchDto } from './update-match.dto';
import { SubmitResultDto } from './submit-result.dto';
import { AdminOverrideResultDto } from './admin-override.dto';
import { AddPlayersDto, PlayerDto } from './add-players.dto';
import { ListMatchesDto } from './list-matches.dto';

describe('CreateMatchDto', () => {
  it('instantiates with default matchType', () => {
    const dto = new CreateMatchDto();
    expect(dto.matchType).toBe('2v2');
  });

  it('accepts valid matchType values', async () => {
    for (const matchType of ['1v1', '2v2', '4v4'] as const) {
      const dto = plainToInstance(CreateMatchDto, { matchType });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid matchType', async () => {
    const dto = plainToInstance(CreateMatchDto, { matchType: '3v3' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateMatchDto', () => {
  it('instantiates without scores (all optional)', async () => {
    const dto = new UpdateMatchDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid score range', async () => {
    const dto = plainToInstance(UpdateMatchDto, { scoreA: 0, scoreB: 255 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects scoreA above 255', async () => {
    const dto = plainToInstance(UpdateMatchDto, { scoreA: 256 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'scoreA')).toBe(true);
  });

  it('rejects scoreB below 0', async () => {
    const dto = plainToInstance(UpdateMatchDto, { scoreB: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'scoreB')).toBe(true);
  });
});

describe('SubmitResultDto', () => {
  it('accepts valid scores', async () => {
    const dto = plainToInstance(SubmitResultDto, { scoreA: 5, scoreB: 3 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when scoreA missing', async () => {
    const dto = plainToInstance(SubmitResultDto, { scoreB: 3 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'scoreA')).toBe(true);
  });

  it('rejects when scoreB missing', async () => {
    const dto = plainToInstance(SubmitResultDto, { scoreA: 5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'scoreB')).toBe(true);
  });

  it('accepts boundary values (0 and 255)', async () => {
    const dto = plainToInstance(SubmitResultDto, { scoreA: 0, scoreB: 255 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('AdminOverrideResultDto', () => {
  it('accepts valid scores without reason', async () => {
    const dto = plainToInstance(AdminOverrideResultDto, { scoreA: 6, scoreB: 3 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid scores with reason', async () => {
    const dto = plainToInstance(AdminOverrideResultDto, { scoreA: 6, scoreB: 3, reason: 'Typo correction' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects reason exceeding 1000 chars', async () => {
    const dto = plainToInstance(AdminOverrideResultDto, {
      scoreA: 1,
      scoreB: 0,
      reason: 'x'.repeat(1001),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});

describe('PlayerDto', () => {
  it('accepts valid player data', async () => {
    const dto = plainToInstance(PlayerDto, { userId: 1, team: 'A', slot: 1 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid team value', async () => {
    const dto = plainToInstance(PlayerDto, { userId: 1, team: 'C', slot: 1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'team')).toBe(true);
  });

  it('rejects slot above 4', async () => {
    const dto = plainToInstance(PlayerDto, { userId: 1, team: 'B', slot: 5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'slot')).toBe(true);
  });

  it('accepts optional position', async () => {
    const dto = plainToInstance(PlayerDto, { userId: 2, team: 'B', slot: 2, position: 'goalkeeper' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('AddPlayersDto', () => {
  it('accepts a valid list of players', async () => {
    const dto = plainToInstance(AddPlayersDto, {
      players: [
        { userId: 1, team: 'A', slot: 1 },
        { userId: 2, team: 'B', slot: 1 },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty players array', async () => {
    const dto = plainToInstance(AddPlayersDto, { players: [] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ListMatchesDto', () => {
  it('instantiates with default limit of 20', () => {
    const dto = new ListMatchesDto();
    expect(dto.limit).toBe(20);
  });

  it('accepts all valid status values', async () => {
    for (const status of ['draft', 'playing', 'awaiting_confirmation', 'confirmed', 'cancelled'] as const) {
      const dto = plainToInstance(ListMatchesDto, { status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('accepts all valid matchType values', async () => {
    for (const matchType of ['1v1', '2v2', '4v4'] as const) {
      const dto = plainToInstance(ListMatchesDto, { matchType });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid status', async () => {
    const dto = plainToInstance(ListMatchesDto, { status: 'unknown' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects limit above 100', async () => {
    const dto = plainToInstance(ListMatchesDto, { limit: 101 }, { enableImplicitConversion: true });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts valid cursor string', async () => {
    const dto = plainToInstance(ListMatchesDto, { cursor: 'abc123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
