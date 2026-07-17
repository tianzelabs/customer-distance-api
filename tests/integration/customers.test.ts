import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { Client, Pool } from 'pg';
import type { Express } from 'express';
import request from 'supertest';
import { runMigrations } from '../../scripts/migrate';
import { seedCustomers } from '../../scripts/seed';

const ADMIN_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/customer_distance_test';

let setupPool: Pool;
let app: Express;

beforeAll(async () => {
  const adminClient = new Client({ connectionString: ADMIN_DATABASE_URL });
  await adminClient.connect();
  try {
    await adminClient.query('CREATE DATABASE customer_distance_test');
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code !== '42P04') {
      throw err;
    }
  } finally {
    await adminClient.end();
  }

  setupPool = new Pool({ connectionString: TEST_DATABASE_URL });
  await runMigrations(setupPool, path.join(__dirname, '..', '..', 'migrations'));
  await seedCustomers(setupPool, path.join(__dirname, '..', '..', 'seed-customers.json'));

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { createApp } = await import('../../src/app');
  app = createApp();
}, 30000);

afterAll(async () => {
  await setupPool.end();
  const { pool } = await import('../../src/db');
  await pool.end();
});

describe('GET /customers/count', () => {
  it('returns the real row count (15)', async () => {
    const res = await request(app).get('/customers/count');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 15 });
  });
});

describe('GET /customers/by-distance', () => {
  it('returns customers sorted by ascending distance, with Budapest first at 0 km', async () => {
    const res = await request(app).get('/customers/by-distance');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(15);
    expect(res.body[0].telepules).toBe('Budapest');
    expect(res.body[0].distanceKm).toBe(0);

    const distances = (res.body as Array<{ distanceKm: number | null }>)
      .map((c) => c.distanceKm)
      .filter((d): d is number => d !== null);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });
});
