import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { MatchEntity, MatchStatus, MatchType } from '../entities/match.entity.js';
import { MatchPlayerEntity } from '../entities/match-player.entity.js';
import { MatchConfirmationEntity } from '../entities/match-confirmation.entity.js';
import { AuditLogEntity } from '../entities/audit-log.entity.js';

export interface CursorData {
  createdAt: string;
  id: number;
}

export interface PaginatedMatches {
  data: MatchEntity[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

@Injectable()
export class MatchRepository {
  constructor(
    @InjectRepository(MatchEntity)
    private readonly matchRepo: Repository<MatchEntity>,
    @InjectRepository(MatchPlayerEntity)
    private readonly playerRepo: Repository<MatchPlayerEntity>,
    @InjectRepository(MatchConfirmationEntity)
    private readonly confirmationRepo: Repository<MatchConfirmationEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: number): Promise<MatchEntity | null> {
    return this.matchRepo.findOne({
      where: { id },
      relations: ['players'],
    });
  }

  async save(match: MatchEntity): Promise<MatchEntity> {
    return this.matchRepo.save(match);
  }

  async create(data: Partial<MatchEntity>): Promise<MatchEntity> {
    const match = this.matchRepo.create(data);
    return this.matchRepo.save(match);
  }

  async delete(id: number): Promise<void> {
    await this.matchRepo.delete(id);
  }

  async findPaginated(params: {
    status?: MatchStatus;
    matchType?: MatchType;
    createdBy?: number;
    cursor?: string;
    limit: number;
  }): Promise<PaginatedMatches> {
    const { status, matchType, createdBy, cursor, limit } = params;
    const take = limit + 1;

    const qb = this.matchRepo
      .createQueryBuilder('m')
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take);

    if (status) {
      qb.andWhere('m.status = :status', { status });
    }
    if (matchType) {
      qb.andWhere('m.match_type = :matchType', { matchType });
    }
    if (createdBy) {
      qb.andWhere('m.created_by = :createdBy', { createdBy });
    }
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const cursorData: CursorData = JSON.parse(decoded);
      qb.andWhere(
        '(m.created_at < :cursorAt OR (m.created_at = :cursorAt AND m.id < :cursorId))',
        { cursorAt: cursorData.createdAt, cursorId: cursorData.id },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      const cursorData: CursorData = { createdAt: last.createdAt.toISOString(), id: last.id };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return { data, pagination: { limit, hasMore, nextCursor } };
  }

  async findPlayers(matchId: number): Promise<MatchPlayerEntity[]> {
    return this.playerRepo.find({ where: { matchId } });
  }

  async findPlayer(matchId: number, userId: number): Promise<MatchPlayerEntity | null> {
    return this.playerRepo.findOne({ where: { matchId, userId } });
  }

  async savePlayers(players: Partial<MatchPlayerEntity>[]): Promise<MatchPlayerEntity[]> {
    const entities = players.map((p) => this.playerRepo.create(p));
    return this.playerRepo.save(entities);
  }

  async findConfirmations(matchId: number): Promise<MatchConfirmationEntity[]> {
    return this.confirmationRepo.find({ where: { matchId } });
  }

  async findConfirmation(matchId: number, userId: number): Promise<MatchConfirmationEntity | null> {
    return this.confirmationRepo.findOne({ where: { matchId, userId } });
  }

  async saveConfirmation(matchId: number, userId: number): Promise<MatchConfirmationEntity> {
    const entity = this.confirmationRepo.create({ matchId, userId });
    return this.confirmationRepo.save(entity);
  }

  async deleteAllConfirmations(matchId: number): Promise<void> {
    await this.confirmationRepo.delete({ matchId });
  }

  async saveAuditLog(data: Partial<AuditLogEntity>): Promise<AuditLogEntity> {
    const entity = this.auditLogRepo.create(data);
    return this.auditLogRepo.save(entity);
  }

  async findAuditLogs(entityType: string, entityId: number): Promise<AuditLogEntity[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }
}
