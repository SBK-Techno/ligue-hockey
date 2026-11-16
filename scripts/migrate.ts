import { migrateDatabase } from './lib/db.ts';

migrateDatabase();
process.stdout.write('Database migrated.\n');
