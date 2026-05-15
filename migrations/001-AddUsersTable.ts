import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersTable1715800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
        azure_oid     VARCHAR(36)         NOT NULL COMMENT 'Azure AD Object ID (UUID format)',
        email         VARCHAR(255)        NOT NULL,
        display_name  VARCHAR(255)        NOT NULL,
        is_admin      TINYINT(1)          NOT NULL DEFAULT 0 COMMENT 'Cache of Azure AD group membership; 0=user 1=admin',
        created_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

        PRIMARY KEY (id),
        UNIQUE INDEX idx_users_azure_oid  (azure_oid),
        UNIQUE INDEX idx_users_email      (email),
        INDEX        idx_users_is_admin   (is_admin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
