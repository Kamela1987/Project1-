import { MigrationInterface, QueryRunner } from "typeorm";

export class ZoneBoundary1789801644583 implements MigrationInterface {
    name = 'ZoneBoundary1789801644583'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Not schema TypeORM can diff from entities, so migration:generate
        // doesn't emit it — added by hand. Needs a postgis-enabled Postgres
        // image (see backend/docker-compose*.yml and the CI workflow).
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
        await queryRunner.query(`ALTER TABLE "zones" ADD "boundary" geometry(Polygon,4326)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zones" DROP COLUMN "boundary"`);
        // Deliberately not dropping the postgis extension here — safe to
        // leave installed even with no geometry columns using it.
    }

}
