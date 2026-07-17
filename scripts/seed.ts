import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { lookupCoordinates } from '../src/geocode/reference';

export interface SeedCustomer {
  name: string;
  budget: number;
  location: { city: string; countryCode: string };
  note: string;
}

export async function seedCustomers(targetPool: Pool, seedFilePath: string): Promise<number> {
  const raw = readFileSync(seedFilePath, 'utf-8');
  const customers: SeedCustomer[] = JSON.parse(raw);

  for (const customer of customers) {
    const coords = lookupCoordinates(customer.location.city);
    if (!coords) {
      console.warn(
        `No coordinates found for town "${customer.location.city}" (customer: ${customer.name}) — storing lat/lon as null.`
      );
    }

    await targetPool.query(
      `INSERT INTO customers (name, telepules, lat, lon, budget, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET
         telepules = EXCLUDED.telepules,
         lat = EXCLUDED.lat,
         lon = EXCLUDED.lon,
         budget = EXCLUDED.budget,
         note = EXCLUDED.note`,
      [customer.name, customer.location.city, coords?.lat ?? null, coords?.lon ?? null, customer.budget, customer.note]
    );
  }

  return customers.length;
}

async function main(): Promise<void> {
  const { pool } = await import('../src/db');
  const seedPath = path.join(__dirname, '..', 'seed-customers.json');
  const count = await seedCustomers(pool, seedPath);
  await pool.end();
  console.log(`Seeded ${count} customers.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
