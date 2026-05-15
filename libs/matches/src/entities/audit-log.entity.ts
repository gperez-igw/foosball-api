import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index('idx_audit_entity', ['entityType', 'entityId'])
@Index('idx_audit_actor', ['actorId'])
@Index('idx_audit_created_at', ['createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'actor_id', type: 'bigint', unsigned: true, nullable: true, default: null })
  actorId: number | null;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'bigint', unsigned: true })
  entityId: number;

  @Column({ name: 'before_data', type: 'json' })
  beforeData: Record<string, unknown>;

  @Column({ name: 'after_data', type: 'json' })
  afterData: Record<string, unknown>;

  @Column({ type: 'text', nullable: true, default: null })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
