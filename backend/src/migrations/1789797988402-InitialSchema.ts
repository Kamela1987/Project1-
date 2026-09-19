import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789797988402 implements MigrationInterface {
    name = 'InitialSchema1789797988402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('rider', 'driver', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phoneNumber" character varying NOT NULL, "name" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'rider', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1e3d0240b49c40521aaeb953293" UNIQUE ("phoneNumber"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."vehicles_type_enum" AS ENUM('sedan', 'minibus', 'motorbike')`);
        await queryRunner.query(`CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "type" "public"."vehicles_type_enum" NOT NULL, "plateNumber" character varying NOT NULL, "photoUrl" character varying, CONSTRAINT "UQ_66ea96381a7a7ceb35c72f36625" UNIQUE ("plateNumber"), CONSTRAINT "REL_9c2e0a8772c9e43b32f57bfcfc" UNIQUE ("driver_id"), CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."drivers_verificationstatus_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "licenseNumber" character varying NOT NULL, "verificationStatus" "public"."drivers_verificationstatus_enum" NOT NULL DEFAULT 'pending', "isOnline" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_8e224f1b8f05ace7cfc7c76d03b" UNIQUE ("user_id"), CONSTRAINT "UQ_754b3d50a8cc64f7ad5c24f62b4" UNIQUE ("licenseNumber"), CONSTRAINT "REL_8e224f1b8f05ace7cfc7c76d03" UNIQUE ("user_id"), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."trips_requestedvehicletype_enum" AS ENUM('sedan', 'minibus', 'motorbike')`);
        await queryRunner.query(`CREATE TYPE "public"."trips_paymentmethod_enum" AS ENUM('cash', 'momo', 'airtel')`);
        await queryRunner.query(`CREATE TYPE "public"."trips_status_enum" AS ENUM('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rider_id" uuid NOT NULL, "driver_id" uuid, "pickupLat" double precision NOT NULL, "pickupLng" double precision NOT NULL, "pickupLandmark" character varying, "dropoffLat" double precision NOT NULL, "dropoffLng" double precision NOT NULL, "dropoffLandmark" character varying, "requestedVehicleType" "public"."trips_requestedvehicletype_enum", "paymentMethod" "public"."trips_paymentmethod_enum" NOT NULL DEFAULT 'cash', "status" "public"."trips_status_enum" NOT NULL DEFAULT 'requested', "fareAmount" numeric(10,2), "requestedAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."trip_status_events_status_enum" AS ENUM('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "trip_status_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "status" "public"."trip_status_events_status_enum" NOT NULL, "occurredAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4ae175ed6907ad4280710e01bc9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('cash', 'momo', 'airtel')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'collected', 'failed')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "driver_id" uuid, "rider_id" uuid, "method" "public"."payments_method_enum" NOT NULL DEFAULT 'cash', "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "amount" numeric(10,2) NOT NULL, "providerReference" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bd02a6beaa5c282445abc4b3507" UNIQUE ("trip_id"), CONSTRAINT "REL_bd02a6beaa5c282445abc4b350" UNIQUE ("trip_id"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "driver_id" uuid NOT NULL, "balance" numeric(10,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_7259be115b1280d8e19cf90bc79" UNIQUE ("driver_id"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ledger_entries_type_enum" AS ENUM('commission', 'settlement', 'trip_earning', 'payout')`);
        await queryRunner.query(`CREATE TABLE "ledger_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "wallet_id" uuid NOT NULL, "trip_id" uuid, "type" "public"."ledger_entries_type_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "note" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6efcb84411d3f08b08450ae75d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ratings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "driver_id" uuid NOT NULL, "rider_id" uuid NOT NULL, "stars" integer NOT NULL, "comment" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9433e63629915a4e102a3462b74" UNIQUE ("trip_id"), CONSTRAINT "REL_9433e63629915a4e102a3462b7" UNIQUE ("trip_id"), CONSTRAINT "PK_0f31425b073219379545ad68ed9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."disputes_status_enum" AS ENUM('open', 'resolved')`);
        await queryRunner.query(`CREATE TABLE "disputes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "raised_by_user_id" uuid NOT NULL, "reason" character varying NOT NULL, "status" "public"."disputes_status_enum" NOT NULL DEFAULT 'open', "resolutionNote" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "resolvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "zones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, CONSTRAINT "UQ_4f5b05ffd4b4daee685dea35ed4" UNIQUE ("name"), CONSTRAINT "PK_880484a43ca311707b05895bd4a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."fare_rules_vehicletype_enum" AS ENUM('sedan', 'minibus', 'motorbike')`);
        await queryRunner.query(`CREATE TABLE "fare_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "zone_id" uuid NOT NULL, "vehicleType" "public"."fare_rules_vehicletype_enum" NOT NULL, "baseFare" numeric(10,2) NOT NULL, "perKmRate" numeric(10,2) NOT NULL, "perMinRate" numeric(10,2) NOT NULL, CONSTRAINT "PK_1c92ac1ed8aaacbdb493f50ca91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0119ac1eb7728cf54e9b243823" ON "fare_rules" ("zone_id", "vehicleType") `);
        await queryRunner.query(`ALTER TABLE "vehicles" ADD CONSTRAINT "FK_9c2e0a8772c9e43b32f57bfcfcc" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "drivers" ADD CONSTRAINT "FK_8e224f1b8f05ace7cfc7c76d03b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trips" ADD CONSTRAINT "FK_1c8cf86705e1cbabb98f6132ac7" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trips" ADD CONSTRAINT "FK_44d36110fb38f45c2f15c946ddb" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trip_status_events" ADD CONSTRAINT "FK_08592abde9d6cc448090bd509ba" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_bd02a6beaa5c282445abc4b3507" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ledger_entries" ADD CONSTRAINT "FK_bb5cd6d7046b98d8faabe9c18fe" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ratings" ADD CONSTRAINT "FK_9433e63629915a4e102a3462b74" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_f7126a0e68dd64bd13c9fdef96f" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fare_rules" ADD CONSTRAINT "FK_c702fb63c80075a435e1cd218c7" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fare_rules" DROP CONSTRAINT "FK_c702fb63c80075a435e1cd218c7"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_f7126a0e68dd64bd13c9fdef96f"`);
        await queryRunner.query(`ALTER TABLE "ratings" DROP CONSTRAINT "FK_9433e63629915a4e102a3462b74"`);
        await queryRunner.query(`ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_bb5cd6d7046b98d8faabe9c18fe"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_bd02a6beaa5c282445abc4b3507"`);
        await queryRunner.query(`ALTER TABLE "trip_status_events" DROP CONSTRAINT "FK_08592abde9d6cc448090bd509ba"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_44d36110fb38f45c2f15c946ddb"`);
        await queryRunner.query(`ALTER TABLE "trips" DROP CONSTRAINT "FK_1c8cf86705e1cbabb98f6132ac7"`);
        await queryRunner.query(`ALTER TABLE "drivers" DROP CONSTRAINT "FK_8e224f1b8f05ace7cfc7c76d03b"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP CONSTRAINT "FK_9c2e0a8772c9e43b32f57bfcfcc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0119ac1eb7728cf54e9b243823"`);
        await queryRunner.query(`DROP TABLE "fare_rules"`);
        await queryRunner.query(`DROP TYPE "public"."fare_rules_vehicletype_enum"`);
        await queryRunner.query(`DROP TABLE "zones"`);
        await queryRunner.query(`DROP TABLE "disputes"`);
        await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
        await queryRunner.query(`DROP TABLE "ratings"`);
        await queryRunner.query(`DROP TABLE "ledger_entries"`);
        await queryRunner.query(`DROP TYPE "public"."ledger_entries_type_enum"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
        await queryRunner.query(`DROP TABLE "trip_status_events"`);
        await queryRunner.query(`DROP TYPE "public"."trip_status_events_status_enum"`);
        await queryRunner.query(`DROP TABLE "trips"`);
        await queryRunner.query(`DROP TYPE "public"."trips_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."trips_paymentmethod_enum"`);
        await queryRunner.query(`DROP TYPE "public"."trips_requestedvehicletype_enum"`);
        await queryRunner.query(`DROP TABLE "drivers"`);
        await queryRunner.query(`DROP TYPE "public"."drivers_verificationstatus_enum"`);
        await queryRunner.query(`DROP TABLE "vehicles"`);
        await queryRunner.query(`DROP TYPE "public"."vehicles_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
