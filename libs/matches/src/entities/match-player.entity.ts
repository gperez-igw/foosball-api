import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { MatchEntity } from './match.entity.js';

export type Team = 'A' | 'B';

@Entity('match_players')
@Unique('idx_mp_match_team_slot', ['matchId', 'team', 'slot'])
@Index('idx_mp_user_id', ['userId'])
export class MatchPlayerEntity {
  @PrimaryColumn({ name: 'match_id', type: 'bigint', unsigned: true })
  matchId: number;

  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @Column({ type: 'enum', enum: ['A', 'B'] })
  team: Team;

  @Column({ type: 'tinyint', unsigned: true })
  slot: number;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  position: string | null;

  @ManyToOne(() => MatchEntity, (match) => match.players, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: MatchEntity;
}
