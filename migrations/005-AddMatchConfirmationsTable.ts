import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchConfirmationsTable1715800000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS match_confirmations (
        match_id      BIGINT UNSIGNED     NOT NULL,
        user_id       BIGINT UNSIGNED     NOT NULL,
        confirmed_at  DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

        PRIMARY KEY (match_id, user_id),

        CONSTRAINT fk_mc_match
          FOREIGN KEY (match_id) REFERENCES matches(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_mc_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS match_confirmations`);
  }
}
