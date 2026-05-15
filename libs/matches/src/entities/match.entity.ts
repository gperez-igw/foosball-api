import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export type MatchType = '1v1' | '2v2' | '4v4';
export type MatchStatus = 'draft' | 'playing' | 'awaiting_confirmation' | 'confirmed' | 'cancelled';

@Entity('matches')
@Index('idx_matches_status_created', ['status', 'createdAt'])
@Index('idx_matches_created_by', ['createdBy'])
@Index('idx_matches_confirmed_at', ['confirmedAt'])
@Index('idx_matches_status_confirmed', ['status', 'confirmedAt'])
export class MatchEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true, default: null })
  createdBy: number | null;

  @Column({
    name: 'match_type',
    type: 'enum',
    enum: ['1v1', '2v2', '4v4'],
    default: '2v2',
  })
  matchType: MatchType;

  @Column({
    type: 'enum',
    enum: ['draft', 'playing', 'awaiting_confirmation', 'confirmed', 'cancelled'],
    default: 'draft',
  })
  status: MatchStatus;

  @Column({ name: 'score_a', type: 'tinyint', unsigned: true, nullable: true, default: null })
  scoreA: number | null;

  @Column({ name: 'score_b', type: 'tinyint', unsigned: true, nullable: true, default: null })
  scoreB: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @Column({ name: 'confirmed_at', type: 'datetime', precision: 3, nullable: true, default: null })
  confirmedAt: Date | null;

  @Column({ name: 'locked_at', type: 'datetime', precision: 3, nullable: true, default: null })
  lockedAt: Date | null;

  @OneToMany('MatchPlayerEntity', 'match', { cascade: true })
  players: any[];

  @OneToMany('MatchConfirmationEntity', 'match', { cascade: true })
  confirmations: any[];
}
