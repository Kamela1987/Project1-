import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';

/**
 * Out-of-band admin creation — the only way an admin account gets made.
 * AuthService.verifyOtp refuses `role: "admin"` from self-service signup,
 * so this direct-DB script (run from the ops side, not the API) is the
 * one path to promoting someone. Usage:
 *
 *   npm run build && npm run seed:admin -- +260955000000 "Site Admin"
 */
async function main() {
  const [phoneNumber, name] = process.argv.slice(2);
  if (!phoneNumber || !name) {
    console.error('Usage: npm run seed:admin -- <phoneNumber> <name>');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'monze',
    password: process.env.DB_PASSWORD ?? 'monze',
    database: process.env.DB_NAME ?? 'monze_ride',
    entities: [User],
  });
  await dataSource.initialize();

  const users = dataSource.getRepository(User);
  const existing = await users.findOneBy({ phoneNumber });
  if (existing) {
    existing.role = UserRole.ADMIN;
    await users.save(existing);
    console.log(`Promoted existing user ${phoneNumber} to admin.`);
  } else {
    const admin = users.create({ phoneNumber, name, role: UserRole.ADMIN });
    await users.save(admin);
    console.log(`Created admin user ${phoneNumber}.`);
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
