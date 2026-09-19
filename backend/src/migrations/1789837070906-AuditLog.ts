import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLog1789837070906 implements MigrationInterface {
    name = 'AuditLog1789837070906'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_log_entries_action_enum" AS ENUM('driver.approved', 'dispute.resolved')`);
        await queryRunner.query(`CREATE TABLE "audit_log_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_user_id" uuid NOT NULL, "action" "public"."audit_log_entries_action_enum" NOT NULL, "target_id" character varying NOT NULL, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4f2fbddaca7c6531577e79177a4" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "audit_log_entries"`);
        await queryRunner.query(`DROP TYPE "public"."audit_log_entries_action_enum"`);
    }

}
