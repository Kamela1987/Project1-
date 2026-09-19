import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
        ],
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        // Real migrations now (see src/migrations/, src/data-source.ts) —
        // synchronize's live schema-diffing was fine for early scaffolding
        // but gave no audit trail and no safe rollback. migrationsRun
        // keeps `npm run start:dev` convenient for local dev; a real
        // deployment would run `npm run migration:run` as its own step
        // instead of relying on app boot to apply schema changes.
        synchronize: false,
        migrationsRun: true,
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
  ],
})
export class AppModule {}
