import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { TripsModule } from './trips/trips.module';
import { PaymentsModule } from './payments/payments.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RatingsModule } from './ratings/ratings.module';
import { DisputesModule } from './disputes/disputes.module';
import { ZonesModule } from './zones/zones.module';
import { FareRulesModule } from './fare-rules/fare-rules.module';
import { TownsModule } from './towns/towns.module';
import { ReferralsModule } from './referrals/referrals.module';
import { User } from './entities/user.entity';
import { Driver } from './entities/driver.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Trip } from './entities/trip.entity';
import { TripStatusEvent } from './entities/trip-status-event.entity';
import { Payment } from './entities/payment.entity';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Rating } from './entities/rating.entity';
import { Dispute } from './entities/dispute.entity';
import { Zone } from './entities/zone.entity';
import { FareRule } from './entities/fare-rule.entity';
import { Town } from './entities/town.entity';
import { ReferralReward } from './entities/referral-reward.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global (see ScheduleModule.forRoot's `global: true`) — backs
    // PayoutSchedulerService's cron job for automatic driver payouts.
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'monze'),
        password: config.get('DB_PASSWORD', 'monze'),
        database: config.get('DB_NAME', 'monze_ride'),
        entities: [
          User,
          Driver,
          Vehicle,
          Trip,
          TripStatusEvent,
          Payment,
          Wallet,
          LedgerEntry,
          Rating,
          Dispute,
          Zone,
          FareRule,
          Town,
          ReferralReward,
        ],
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        // Real migrations now (see src/migrations/, src/data-source.ts) —
        // synchronize's live schema-diffing was fine for early scaffolding
        // but gave no audit trail and no safe rollback. migrationsRun
        // keeps `npm run start:dev` convenient for local dev. The Docker
        // image (see backend/Dockerfile) sets MIGRATIONS_RUN=false and runs
        // `npm run migration:run:prod` as its own deploy step instead —
        // multiple app instances racing to apply migrations on every boot
        // isn't something you want in production.
        synchronize: false,
        migrationsRun: config.get('MIGRATIONS_RUN', 'true') === 'true',
      }),
    }),
    AuthModule,
    UsersModule,
    DriversModule,
    TripsModule,
    PaymentsModule,
    RealtimeModule,
    RatingsModule,
    DisputesModule,
    ZonesModule,
    FareRulesModule,
    TownsModule,
    ReferralsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
