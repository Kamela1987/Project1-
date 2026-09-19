import { MigrationInterface, QueryRunner } from "typeorm";

export class MultiTown1789804259630 implements MigrationInterface {
    name = 'MultiTown1789804259630'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "towns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "boundary" geometry(Polygon,4326), CONSTRAINT "UQ_2d2b2a755254e0c050ac4596bfb" UNIQUE ("name"), CONSTRAINT "PK_8f5c3dbce1d3ea5de7dcc48c230" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "trips" ADD "town_id" uuid`);
        await queryRunner.query(`ALTER TABLE "zones" ADD "town_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zones" DROP COLUMN "town_id"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "town_id"`);
        await queryRunner.query(`DROP TABLE "towns"`);
    }

}
