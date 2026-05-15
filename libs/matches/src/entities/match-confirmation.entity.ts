import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { MatchEntity } from './match.entity.js';

@Entity('match_confirmations')
export class MatchConfirmationEntity {
  @PrimaryColumn({ name: 'match_id', type: 'bigint', unsigned: true })
  matchId: number;

  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @CreateDateColumn({ name: 'confirmed_at', type: 'datetime', precision: 3 })
  confirmedAt: Date;

  @ManyToOne(() => MatchEntity, (match) => match.confirmations, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: MatchEntity;
}
