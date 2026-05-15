import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogsTable1715800000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
        actor_id      BIGINT UNSIGNED     NULL     DEFAULT NULL COMMENT 'Admin who performed the action; NULL if user deleted',
        action        VARCHAR(64)         NOT NULL COMMENT 'e.g. result_override, match_delete, score_correct',
        entity_type   VARCHAR(64)         NOT NULL COMMENT 'Always ''match'' for MVP',
        entity_id     BIGINT UNSIGNED     NOT NULL COMMENT 'Soft reference to matches.id (no FK)',
        before_data   JSON                NOT NULL COMMENT 'Snapshot of changed fields before override',
        after_data    JSON                NOT NULL COMMENT 'Snapshot of changed fields after override',
        reason        TEXT                NULL     DEFAULT NULL COMMENT 'Admin note; optional but recommended',
        created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

        PRIMARY KEY (id),
        INDEX idx_audit_entity            (entity_type, entity_id),
        INDEX idx_audit_actor             (actor_id),
        INDEX idx_audit_created_at        (created_at),

        CONSTRAINT fk_audit_actor
          FOREIGN KEY (actor_id) REFERENCES users(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
  }
}
