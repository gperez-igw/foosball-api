import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchesTable1715800000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
        created_by    BIGINT UNSIGNED     NULL     DEFAULT NULL COMMENT 'Creator user_id; NULL if user deleted',
        match_type    ENUM('1v1','2v2','4v4') NOT NULL DEFAULT '2v2',
        status        ENUM('draft','playing','awaiting_confirmation','confirmed','cancelled')
                                          NOT NULL DEFAULT 'draft',
        score_a       TINYINT UNSIGNED    NULL     DEFAULT NULL COMMENT 'Team A score; NULL until result submitted',
        score_b       TINYINT UNSIGNED    NULL     DEFAULT NULL COMMENT 'Team B score; NULL until result submitted',
        created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        confirmed_at  DATETIME(3)         NULL     DEFAULT NULL COMMENT 'Timestamp when quorum reached; immutable after',
        locked_at     DATETIME(3)         NULL     DEFAULT NULL COMMENT 'Reserved; equals confirmed_at in MVP',

        PRIMARY KEY (id),
        INDEX idx_matches_status_created     (status, created_at),
        INDEX idx_matches_created_by         (created_by),
        INDEX idx_matches_confirmed_at       (confirmed_at),
        INDEX idx_matches_status_confirmed   (status, confirmed_at),

        CONSTRAINT fk_matches_created_by
          FOREIGN KEY (created_by) REFERENCES users(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS matches`);
  }
}
