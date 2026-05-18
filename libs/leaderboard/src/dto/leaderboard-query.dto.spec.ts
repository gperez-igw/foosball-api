import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LeaderboardQueryDto } from './leaderboard-query.dto';

describe('LeaderboardQueryDto', () => {
  it('instantiates with default values', () => {
    const dto = new LeaderboardQueryDto();
    expect(dto.filter).toBe('total');
    expect(dto.limit).toBe(20);
  });

  it('accepts all valid filter values', async () => {
    for (const filter of ['week', 'month', 'year', 'total'] as const) {
      const dto = plainToInstance(LeaderboardQueryDto, { filter });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid filter value', async () => {
    const dto = plainToInstance(LeaderboardQueryDto, { filter: 'quarterly' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'filter')).toBe(true);
  });

  it('accepts limit within bounds [1, 100]', async () => {
    for (const limit of [1, 50, 100]) {
      const dto = plainToInstance(LeaderboardQueryDto, { limit }, { enableImplicitConversion: true });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects limit below 1', async () => {
    const dto = plainToInstance(LeaderboardQueryDto, { limit: 0 }, { enableImplicitConversion: true });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit above 100', async () => {
    const dto = plainToInstance(LeaderboardQueryDto, { limit: 101 }, { enableImplicitConversion: true });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('is valid with no params (all optional)', async () => {
    const dto = plainToInstance(LeaderboardQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
