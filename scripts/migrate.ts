import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

export async function runMigrations(targetPool: Pool, migrationsDir: string): Promise<void> {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running migration: ${file}`);
    await targetPool.query(sql);
  }
}

async function main(): Promise<void> {
  const { pool } = await import('../src/db');
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  await runMigrations(pool, migrationsDir);
  await pool.end();
  console.log('Migrations complete.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
