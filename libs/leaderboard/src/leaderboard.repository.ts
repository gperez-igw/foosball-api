import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TimeFilter } from './dto/leaderboard-query.dto.js';

export interface UserWinEntry {
  userId: number;
  displayName: string;
  wins: number;
}

export interface PairWinEntry {
  userAId: number;
  userAName: string;
  userBId: number;
  userBName: string;
  wins: number;
}

@Injectable()
export class LeaderboardRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getStartDate(filter: TimeFilter): Date | null {
    if (filter === 'total') return null;
    const now = new Date();
    if (filter === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (filter === 'month') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    if (filter === 'year') {
      const d = new Date(now);
      d.setDate(d.getDate() - 365);
      return d;
    }
    return null;
  }

  async getUserWins(filter: TimeFilter, limit: number): Promise<UserWinEntry[]> {
    const startDate = this.getStartDate(filter);

    let sql = `
      SELECT
        u.id AS userId,
        u.display_name AS displayName,
        COUNT(*) AS wins
      FROM matches m
      JOIN match_players mp ON mp.match_id = m.id
        AND mp.team = CASE WHEN m.score_a > m.score_b THEN 'A' WHEN m.score_b > m.score_a THEN 'B' ELSE NULL END
      JOIN users u ON u.id = mp.user_id
      WHERE m.status = 'confirmed'
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        AND m.score_a != m.score_b
    `;

    const params: unknown[] = [];

    if (startDate) {
      sql += ` AND m.confirmed_at >= ?`;
      params.push(startDate);
    }

    sql += ` GROUP BY u.id, u.display_name ORDER BY wins DESC LIMIT ?`;
    params.push(limit);

    const rows = await this.dataSource.query(sql, params);
    return rows.map((r: any) => ({
      userId: Number(r.userId),
      displayName: r.displayName,
      wins: Number(r.wins),
    }));
  }

  async getPairWins(filter: TimeFilter, limit: number): Promise<PairWinEntry[]> {
    const startDate = this.getStartDate(filter);

    let sql = `
      SELECT
        mp1.user_id AS userAId,
        u1.display_name AS userAName,
        mp2.user_id AS userBId,
        u2.display_name AS userBName,
        COUNT(*) AS wins
      FROM matches m
      JOIN match_players mp1 ON mp1.match_id = m.id
        AND mp1.team = CASE WHEN m.score_a > m.score_b THEN 'A' WHEN m.score_b > m.score_a THEN 'B' ELSE NULL END
      JOIN match_players mp2 ON mp2.match_id = m.id
        AND mp2.team = mp1.team
        AND mp2.user_id > mp1.user_id
      JOIN users u1 ON u1.id = mp1.user_id
      JOIN users u2 ON u2.id = mp2.user_id
      WHERE m.status = 'confirmed'
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        AND m.score_a != m.score_b
    `;

    const params: unknown[] = [];

    if (startDate) {
      sql += ` AND m.confirmed_at >= ?`;
      params.push(startDate);
    }

    sql += `
      GROUP BY mp1.user_id, u1.display_name, mp2.user_id, u2.display_name
      ORDER BY wins DESC
      LIMIT ?
    `;
    params.push(limit);

    const rows = await this.dataSource.query(sql, params);
    return rows.map((r: any) => ({
      userAId: Number(r.userAId),
      userAName: r.userAName,
      userBId: Number(r.userBId),
      userBName: r.userBName,
      wins: Number(r.wins),
    }));
  }
}
