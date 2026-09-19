import { MigrationInterface, QueryRunner } from "typeorm";

export class DriverAutoPayout1789803739577 implements MigrationInterface {
    name = 'DriverAutoPayout1789803739577'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "drivers" ADD "autoPayoutEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE TYPE "public"."drivers_payoutmethod_enum" AS ENUM('cash', 'momo', 'airtel')`);
        await queryRunner.query(`ALTER TABLE "drivers" ADD "payoutMethod" "public"."drivers_payoutmethod_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN "payoutMethod"`);
        await queryRunner.query(`DROP TYPE "public"."drivers_payoutmethod_enum"`);
        await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN "autoPayoutEnabled"`);
    }

}
