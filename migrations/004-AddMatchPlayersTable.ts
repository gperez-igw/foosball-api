import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchPlayersTable1715800000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS match_players (
        match_id      BIGINT UNSIGNED     NOT NULL,
        user_id       BIGINT UNSIGNED     NOT NULL,
        team          ENUM('A','B')       NOT NULL,
        slot          TINYINT UNSIGNED    NOT NULL COMMENT '1-based slot within team (max 4)',
        position      VARCHAR(64)         NULL     DEFAULT NULL COMMENT 'Optional display label',

        PRIMARY KEY (match_id, user_id),
        UNIQUE INDEX idx_mp_match_team_slot (match_id, team, slot),
        INDEX        idx_mp_user_id         (user_id),

        CONSTRAINT fk_mp_match
          FOREIGN KEY (match_id) REFERENCES matches(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_mp_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE RESTRICT ON UPDATE CASCADE,

        CONSTRAINT chk_mp_slot CHECK (slot BETWEEN 1 AND 4)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS match_players`);
  }
}
