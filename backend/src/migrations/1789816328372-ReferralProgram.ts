import { MigrationInterface, QueryRunner } from "typeorm";

export class ReferralProgram1789816328372 implements MigrationInterface {
    name = 'ReferralProgram1789816328372'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "referral_rewards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referrer_user_id" uuid NOT NULL, "referred_user_id" uuid NOT NULL, "trip_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3be1dc8ab03f052b59d8aefbad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "referralCode" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_b7f8278f4e89249bb75c9a15899" UNIQUE ("referralCode")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "referred_by_user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "users" ADD "referralCreditBalance" numeric(10,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referralCreditBalance"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referred_by_user_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_b7f8278f4e89249bb75c9a15899"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "referralCode"`);
        await queryRunner.query(`DROP TABLE "referral_rewards"`);
    }

}
