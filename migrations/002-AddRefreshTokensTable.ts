import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokensTable1715800000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
        user_id       BIGINT UNSIGNED     NOT NULL,
        token_hash    VARCHAR(64)         NOT NULL COMMENT 'SHA-256 hex digest of the raw refresh token',
        expires_at    DATETIME(3)         NOT NULL COMMENT '24h from issuance',
        used_at       DATETIME(3)         NULL     DEFAULT NULL COMMENT 'NULL = still valid; set on rotation',
        replaced_by   BIGINT UNSIGNED     NULL     DEFAULT NULL COMMENT 'FK to the replacement token in chain',
        created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

        PRIMARY KEY (id),
        UNIQUE INDEX idx_rt_token_hash    (token_hash),
        INDEX        idx_rt_user_id       (user_id),
        INDEX        idx_rt_expires       (expires_at),

        CONSTRAINT fk_rt_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_rt_replaced_by
          FOREIGN KEY (replaced_by) REFERENCES refresh_tokens(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
  }
}
