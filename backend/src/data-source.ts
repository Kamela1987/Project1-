import 'dotenv/config';
import { DataSource } from 'typeorm';
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

/**
 * CLI-only entry point for `npm run typeorm` / `migration:*` scripts (see
 * package.json). The running app still gets its config through
 * AppModule's TypeOrmModule.forRootAsync (so it can use Nest's
 * ConfigService) — this file exists only because the TypeORM CLI needs a
 * plain, synchronously-importable DataSource, and reads the same DB_*
 * env vars directly since there's no Nest DI container to hand it one.
 * Keep the connection options and entity list here in sync with
 * app.module.ts.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'monze',
  password: process.env.DB_PASSWORD ?? 'monze',
  database: process.env.DB_NAME ?? 'monze_ride',
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
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
