# Customer Distance API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline REST API over Postgres that serves the 15 seed customers with their distance to Budapest, geocoded from a locally bundled town→coordinate reference (no external geocoding/LLM calls at runtime).

**Architecture:** Node.js + TypeScript + Express, `pg` (node-postgres) with raw SQL (no ORM). Hand-written SQL migration run by a small script. A static, bundled town→coordinate reference table with accent/case/whitespace-insensitive lookup. Distance and sorting computed in the application layer (15 rows — no need for Postgres geo extensions). Postgres runs via Docker Compose.

**Tech Stack:** Node.js, TypeScript, Express, pg, dotenv, Vitest, supertest, Docker Compose (`postgres:16-alpine`), `@modelcontextprotocol/server-postgres` MCP server.

**Reference:** Full design rationale in `docs/superpowers/specs/2026-07-17-customer-distance-api-design.md`.

## Global Constraints

These apply to every task below; re-read before starting any task.

- Runtime must be **fully offline**: no external geocoding API calls, no LLM calls, anywhere in the request or seed path.
- `customers` table has at minimum `id, name, telepules, lat, lon`; `lat` and `lon` are **nullable** (no `NOT NULL`).
- `seed-customers.json` (repo root) contains exactly **15 customers**. After seeding, `SELECT COUNT(*) FROM customers` must equal 15.
- Seeding is **idempotent**: running the seed script twice must not create duplicate rows (enforced via `UNIQUE (name)` + `ON CONFLICT (name) DO UPDATE`).
- Town matching is **case-, whitespace-, and accent-insensitive**. `"Budapest"` (and district suffixes like `"Budapest XIII. kerület"`) always resolve to the same capital-city coordinate.
- An unmatched town results in `lat = null, lon = null`, a `console.warn` log line, and the seed process **must continue** (never throw/crash on an unknown town).
- `GET /customers/count` returns `{ "count": <int> }` reflecting the real row count.
- `GET /customers/by-distance` returns customers ascending by `distanceKm`; Budapest customers first at `0`; customers with unknown coordinates last with `distanceKm: null`; ties broken by `name`; `distanceKm` rounded to 1 decimal.
- Haversine unit tests must cover: Budapest→Vienna (~214 km), the 0 km case (Budapest→Budapest), and the null-coordinate case.
- A Postgres MCP server must be configured so schema/data can be inspected during development.
- README must document: starting Postgres, running the migration, seeding, starting the server, running the tests.
- Small, focused commits — one per task, at the end of each task.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: npm scripts `dev`, `start`, `build`, `migrate`, `seed`, `test` that every later task relies on; `DATABASE_URL` env var convention (`postgresql://postgres:postgres@localhost:5432/customer_distance`); Postgres reachable at `localhost:5432` once `docker compose up -d` has been run.

- [ ] **Step 1: Confirm Docker is available**

Run: `docker --version && docker compose version`

Expected: both commands print a version string. If either command fails ("command not found" or similar), **STOP** — tell the user Docker/Docker Compose must be installed before continuing (they indicated they would install it themselves), and wait for confirmation before proceeding to Step 2.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "customer-distance-api",
  "version": "1.0.0",
  "private": true,
  "description": "Offline REST API serving customer distance-to-Budapest over Postgres.",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/server.ts",
    "start": "node dist/server.js",
    "migrate": "tsx scripts/migrate.ts",
    "seed": "tsx scripts/seed.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.0",
    "@types/pg": "^8.11.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "scripts", "tests"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: customer_distance
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - customer_distance_pgdata:/var/lib/postgresql/data

volumes:
  customer_distance_pgdata:
```

- [ ] **Step 6: Create `.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customer_distance
PORT=3000
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`

Expected: exits 0, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 9: Start Postgres and verify it's reachable**

Run:
```bash
docker compose up -d
docker compose ps
```

Expected: the `db` service shows state `Up` (or `running`/`healthy`).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts docker-compose.yml .env.example .gitignore
git commit -m "chore: scaffold Node/TypeScript project with Docker Compose Postgres"
```

---

### Task 2: Database pool & migration

**Files:**
- Create: `src/db.ts`
- Create: `migrations/001_init.sql`
- Create: `scripts/migrate.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` env var (from Task 1's `.env.example` convention); npm script `migrate` (Task 1).
- Produces: `pool` (singleton `pg.Pool`, `src/db.ts`, throws if `DATABASE_URL` unset) — used by `src/routes/customers.ts` (Task 6) and CLI entrypoints. `runMigrations(targetPool: Pool, migrationsDir: string): Promise<void>` (`scripts/migrate.ts`) — reused by the integration test setup (Task 7). `customers` table schema: `id SERIAL PRIMARY KEY, name TEXT NOT NULL, telepules TEXT NOT NULL, lat DOUBLE PRECISION, lon DOUBLE PRECISION, budget INTEGER, note TEXT, UNIQUE (name)`.

- [ ] **Step 1: Create `.env` from the example**

Run: `cp .env.example .env`

- [ ] **Step 2: Create `src/db.ts`**

```ts
import { Pool } from 'pg';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

export const pool = new Pool({ connectionString: getDatabaseUrl() });
```

- [ ] **Step 3: Create `migrations/001_init.sql`**

```sql
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  telepules TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  budget INTEGER,
  note TEXT,
  UNIQUE (name)
);
```

- [ ] **Step 4: Create `scripts/migrate.ts`**

```ts
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
```

- [ ] **Step 5: Run the migration and verify the table exists**

Run:
```bash
npm run migrate
docker compose exec db psql -U postgres -d customer_distance -c '\d customers'
```

Expected: `npm run migrate` prints `Running migration: 001_init.sql` and `Migrations complete.`; the `psql` output lists columns `id, name, telepules, lat, lon, budget, note` with `lat`/`lon` **not** marked `not null`, and a unique constraint on `name`.

- [ ] **Step 6: Verify re-running the migration is safe (idempotent DDL)**

Run: `npm run migrate`

Expected: exits 0, no errors (the `CREATE TABLE IF NOT EXISTS` is a no-op on the second run).

- [ ] **Step 7: Commit**

```bash
git add src/db.ts migrations/001_init.sql scripts/migrate.ts
git commit -m "feat: add Postgres pool and idempotent schema migration"
```

---

### Task 3: Geocoding reference & normalization

**Files:**
- Create: `src/geocode/normalize.ts`
- Create: `src/geocode/reference.ts`

**Interfaces:**
- Consumes: nothing (pure functions/data, no DB or env dependency).
- Produces: `normalizeTownName(input: string): string` — lowercase, trimmed, whitespace-collapsed, accent-stripped; town names starting with `"budapest"` after normalization collapse to `"budapest"`. `Coordinates { lat: number; lon: number }`, `BUDAPEST: Coordinates`, `TOWN_REFERENCE: Record<string, Coordinates>`, `lookupCoordinates(townName: string): Coordinates | null` (`src/geocode/reference.ts`) — used by `scripts/seed.ts` (Task 4) and `src/routes/customers.ts` (Task 6, for the `BUDAPEST` origin constant).

- [ ] **Step 1: Create `src/geocode/normalize.ts`**

```ts
export function normalizeTownName(input: string): string {
  const collapsedWhitespace = input.trim().replace(/\s+/g, ' ');
  const lower = collapsedWhitespace.toLowerCase();
  const withoutDiacritics = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');

  if (withoutDiacritics.startsWith('budapest')) {
    return 'budapest';
  }

  return withoutDiacritics;
}
```

- [ ] **Step 2: Create `src/geocode/reference.ts`**

```ts
import { normalizeTownName } from './normalize';

export interface Coordinates {
  lat: number;
  lon: number;
}

export const BUDAPEST: Coordinates = { lat: 47.4979, lon: 19.0402 };

export const TOWN_REFERENCE: Record<string, Coordinates> = {
  budapest: BUDAPEST,
  vienna: { lat: 48.2082, lon: 16.3738 },
  munich: { lat: 48.1351, lon: 11.582 },
  milan: { lat: 45.4642, lon: 9.19 },
  barcelona: { lat: 41.3874, lon: 2.1686 },
  lyon: { lat: 45.764, lon: 4.8357 },
  krakow: { lat: 50.0647, lon: 19.945 },
  prague: { lat: 50.0755, lon: 14.4378 },
  lisbon: { lat: 38.7223, lon: -9.1393 },
  amsterdam: { lat: 52.3676, lon: 4.9041 },
  stockholm: { lat: 59.3293, lon: 18.0686 },
  ljubljana: { lat: 46.0569, lon: 14.5058 },
  bucharest: { lat: 44.4268, lon: 26.1025 },
  dublin: { lat: 53.3498, lon: -6.2603 },
  copenhagen: { lat: 55.6761, lon: 12.5683 },
};

export function lookupCoordinates(townName: string): Coordinates | null {
  const key = normalizeTownName(townName);
  return TOWN_REFERENCE[key] ?? null;
}
```

- [ ] **Step 3: Manually verify normalization and lookup behavior**

Run:
```bash
npx tsx -e "
import { lookupCoordinates } from './src/geocode/reference';
console.log('Budapest:', lookupCoordinates('Budapest'));
console.log('district:', lookupCoordinates('Budapest XIII. kerület'));
console.log('accents/case/whitespace:', lookupCoordinates('  KRAKÓW  '));
console.log('unknown:', lookupCoordinates('Nowheresville'));
"
```

Expected: `Budapest` and `district` both print `{ lat: 47.4979, lon: 19.0402 }`; `accents/case/whitespace` prints the Kraków coordinate `{ lat: 50.0647, lon: 19.945 }`; `unknown` prints `null`.

- [ ] **Step 4: Commit**

```bash
git add src/geocode/normalize.ts src/geocode/reference.ts
git commit -m "feat: add bundled town-to-coordinate reference with normalized lookup"
```

---

### Task 4: Idempotent seed script

**Files:**
- Create: `scripts/seed.ts`

**Interfaces:**
- Consumes: `lookupCoordinates` (`src/geocode/reference.ts`, Task 3); `pool` (`src/db.ts`, Task 2, used only by the CLI entrypoint); `seed-customers.json` (repo root, existing file, 15 entries shaped `{ name, budget, location: { city, countryCode }, note }`).
- Produces: `SeedCustomer` interface and `seedCustomers(targetPool: Pool, seedFilePath: string): Promise<number>` (`scripts/seed.ts`) — reused by the integration test setup (Task 7). Resolves the number of customers seeded.

- [ ] **Step 1: Create `scripts/seed.ts`**

```ts
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
```

- [ ] **Step 2: Run the seed script and verify the row count**

Run:
```bash
npm run seed
docker compose exec db psql -U postgres -d customer_distance -c 'SELECT COUNT(*) FROM customers;'
```

Expected: `npm run seed` prints `Seeded 15 customers.` with **no** warning lines (all 15 seed towns are in the reference); the `psql` count query returns `15`.

- [ ] **Step 3: Verify idempotency by re-running the seed**

Run:
```bash
npm run seed
docker compose exec db psql -U postgres -d customer_distance -c 'SELECT COUNT(*) FROM customers;'
```

Expected: still `Seeded 15 customers.`, count is still `15` (not 30) — confirms the upsert did not duplicate rows.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: add idempotent customer seed script with offline geocoding"
```

---

### Task 5: Haversine distance service (TDD)

**Files:**
- Create: `tests/unit/haversine.test.ts`
- Create: `src/services/distance.ts`

**Interfaces:**
- Consumes: `BUDAPEST` (`src/geocode/reference.ts`, Task 3, used only in the test file as a known coordinate).
- Produces: `CustomerRow { id: number; name: string; telepules: string; lat: number | null; lon: number | null; budget: number | null; note: string | null }`, `CustomerWithDistance extends CustomerRow { distanceKm: number | null }`, `haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number`, `distanceKmFromOrigin(lat: number | null, lon: number | null, origin: { lat: number; lon: number }): number | null`, `attachDistances(customers: CustomerRow[], origin: { lat: number; lon: number }): CustomerWithDistance[]` (`src/services/distance.ts`) — used by `src/routes/customers.ts` (Task 6).

- [ ] **Step 1: Write the failing test file `tests/unit/haversine.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { haversineKm, distanceKmFromOrigin, attachDistances, CustomerRow } from '../../src/services/distance';
import { BUDAPEST } from '../../src/geocode/reference';

describe('haversineKm', () => {
  it('calculates the distance between Budapest and Vienna as approximately 214 km', () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const km = haversineKm(BUDAPEST.lat, BUDAPEST.lon, vienna.lat, vienna.lon);
    expect(km).toBeGreaterThan(212);
    expect(km).toBeLessThan(216);
  });

  it('returns 0 for identical coordinates (Budapest to Budapest)', () => {
    const km = haversineKm(BUDAPEST.lat, BUDAPEST.lon, BUDAPEST.lat, BUDAPEST.lon);
    expect(km).toBe(0);
  });
});

describe('distanceKmFromOrigin', () => {
  it('returns null when lat or lon is null', () => {
    expect(distanceKmFromOrigin(null, null, BUDAPEST)).toBeNull();
    expect(distanceKmFromOrigin(47.5, null, BUDAPEST)).toBeNull();
    expect(distanceKmFromOrigin(null, 19.0, BUDAPEST)).toBeNull();
  });

  it('rounds the distance to one decimal place', () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const km = distanceKmFromOrigin(vienna.lat, vienna.lon, BUDAPEST);
    expect(km).not.toBeNull();
    expect(String(km)).toMatch(/^\d+(\.\d)?$/);
  });
});

describe('attachDistances', () => {
  it('sorts ascending by distance, puts null-distance customers last, and tie-breaks by name', () => {
    const customers: CustomerRow[] = [
      { id: 1, name: 'Zoltan', telepules: 'Unknown City', lat: null, lon: null, budget: null, note: null },
      { id: 2, name: 'Anna', telepules: 'Budapest', lat: BUDAPEST.lat, lon: BUDAPEST.lon, budget: null, note: null },
      { id: 3, name: 'Bela', telepules: 'Unknown City 2', lat: null, lon: null, budget: null, note: null },
    ];

    const result = attachDistances(customers, BUDAPEST);

    expect(result.map((c) => c.name)).toEqual(['Anna', 'Bela', 'Zoltan']);
    expect(result[0].distanceKm).toBe(0);
    expect(result[1].distanceKm).toBeNull();
    expect(result[2].distanceKm).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/haversine.test.ts`

Expected: FAIL — `src/services/distance.ts` does not exist / exports not found.

- [ ] **Step 3: Create `src/services/distance.ts`**

```ts
export interface CustomerRow {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export interface CustomerWithDistance extends CustomerRow {
  distanceKm: number | null;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function distanceKmFromOrigin(
  lat: number | null,
  lon: number | null,
  origin: { lat: number; lon: number }
): number | null {
  if (lat === null || lon === null) {
    return null;
  }
  return roundToOneDecimal(haversineKm(origin.lat, origin.lon, lat, lon));
}

export function sortByDistance(customers: CustomerWithDistance[]): CustomerWithDistance[] {
  return [...customers].sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) {
      return a.name.localeCompare(b.name, 'hu');
    }
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.name.localeCompare(b.name, 'hu');
  });
}

export function attachDistances(
  customers: CustomerRow[],
  origin: { lat: number; lon: number }
): CustomerWithDistance[] {
  const withDistances: CustomerWithDistance[] = customers.map((c) => ({
    ...c,
    distanceKm: distanceKmFromOrigin(c.lat, c.lon, origin),
  }));
  return sortByDistance(withDistances);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/haversine.test.ts`

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/haversine.test.ts src/services/distance.ts
git commit -m "feat: add haversine distance service with sort/rounding rules"
```

---

### Task 6: Express app, routes, and server entrypoint

**Files:**
- Create: `src/routes/customers.ts`
- Create: `src/app.ts`
- Create: `src/server.ts`

**Interfaces:**
- Consumes: `pool` (`src/db.ts`, Task 2); `attachDistances`, `CustomerRow` (`src/services/distance.ts`, Task 5); `BUDAPEST` (`src/geocode/reference.ts`, Task 3).
- Produces: `createApp(): Express` (`src/app.ts`) — used by the integration tests (Task 7). `PORT` env var convention (defaults to `3000`).

- [ ] **Step 1: Create `src/routes/customers.ts`**

```ts
import { Router } from 'express';
import { pool } from '../db';
import { attachDistances, CustomerRow } from '../services/distance';
import { BUDAPEST } from '../geocode/reference';

export const customersRouter = Router();

customersRouter.get('/count', async (_req, res, next) => {
  try {
    const result = await pool.query<{ count: string }>('SELECT COUNT(*) FROM customers');
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    next(err);
  }
});

customersRouter.get('/by-distance', async (_req, res, next) => {
  try {
    const result = await pool.query<CustomerRow>(
      'SELECT id, name, telepules, lat, lon, budget, note FROM customers'
    );
    const withDistances = attachDistances(result.rows, BUDAPEST);
    res.json(withDistances);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Create `src/app.ts`**

```ts
import express, { Express } from 'express';
import { customersRouter } from './routes/customers';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/customers', customersRouter);
  return app;
}
```

- [ ] **Step 3: Create `src/server.ts`**

```ts
import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`customer-distance-api listening on port ${port}`);
});
```

- [ ] **Step 4: Start the server and manually verify both endpoints against the seeded database**

Run (in one terminal): `npm run dev`

Run (in another terminal):
```bash
curl -s http://localhost:3000/customers/count
curl -s http://localhost:3000/customers/by-distance | head -c 500
```

Expected: first command prints `{"count":15}`; second command's output starts with a JSON array whose first element has `"telepules":"Budapest"` and `"distanceKm":0`.

Stop the dev server (Ctrl+C) after verifying.

- [ ] **Step 5: Commit**

```bash
git add src/routes/customers.ts src/app.ts src/server.ts
git commit -m "feat: add customers/count and customers/by-distance endpoints"
```

---

### Task 7: Integration tests

**Files:**
- Create: `tests/integration/customers.test.ts`

**Interfaces:**
- Consumes: `runMigrations` (`scripts/migrate.ts`, Task 2); `seedCustomers` (`scripts/seed.ts`, Task 4); `createApp` (`src/app.ts`, Task 6); `pool` (`src/db.ts`, Task 2, closed in `afterAll`).
- Produces: nothing consumed by later tasks (terminal test file).

- [ ] **Step 1: Create `tests/integration/customers.test.ts`**

```ts
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
```

- [ ] **Step 2: Ensure Postgres is running, then run the full test suite**

Run:
```bash
docker compose up -d
npm test
```

Expected: all tests pass — 5 unit tests (Task 5) + 2 integration tests, 7 total. The integration tests create `customer_distance_test` automatically on first run.

- [ ] **Step 3: Re-run the tests to confirm the test DB setup is itself idempotent**

Run: `npm test`

Expected: still passes (the `CREATE DATABASE` catch-and-ignore on error code `42P04`, plus the upsert-based seed, mean re-running is safe).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/customers.test.ts
git commit -m "test: add integration tests for customers endpoints against a real Postgres"
```

---

### Task 8: README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: npm scripts from Task 1 (`migrate`, `seed`, `dev`, `test`); `docker compose up -d` from Task 1.
- Produces: nothing (documentation only).

- [ ] **Step 1: Read the current `README.md`**

The file currently contains only a short Hungarian intro paragraph describing the assignment. Keep that paragraph and append the sections below.

- [ ] **Step 2: Append run instructions to `README.md`**

Add the following content after the existing intro paragraph:

```markdown

## Előfeltételek

- Node.js 20+
- Docker és Docker Compose

## Indítás

1. Postgres indítása:

   ```bash
   docker compose up -d
   ```

2. Függőségek telepítése:

   ```bash
   npm install
   ```

3. Környezeti változók beállítása:

   ```bash
   cp .env.example .env
   ```

4. Séma migrálása:

   ```bash
   npm run migrate
   ```

5. Seed adat betöltése (idempotens — többször is futtatható, nem duplikál):

   ```bash
   npm run seed
   ```

6. Szerver indítása:

   ```bash
   npm run dev
   ```

   Az API a `http://localhost:3000` címen érhető el.

## Végpontok

- `GET /customers/count` — `{ "count": <int> }`
- `GET /customers/by-distance` — ügyfélek listája, Budapesthez viszonyított `distanceKm` szerint növekvő sorrendben

## Tesztek futtatása

```bash
npm test
```

A tesztek (unit + integrációs) futtatásához a Postgres-nek futnia kell (`docker compose up -d`). Az integrációs tesztek egy külön `customer_distance_test` adatbázist hoznak létre és seedelnek automatikusan, a fejlesztői adatbázist nem érintik.

## Postgres MCP

A repo tartalmaz egy `.mcp.json` konfigurációt, amely a helyi Postgres-hez köti a `@modelcontextprotocol/server-postgres` MCP szervert. Az MCP-klienst (pl. Claude Code-ot) újraindítva/a szervereket újratöltve a séma és az adat közvetlenül lekérdezhető fejlesztés közben.
```

- [ ] **Step 3: Sanity-check the documented commands against `package.json`**

Run: `cat package.json | grep -A 10 '"scripts"'`

Expected: every command referenced in the README (`docker compose up -d`, `npm install`, `npm run migrate`, `npm run seed`, `npm run dev`, `npm test`) matches an actual script name in `package.json`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add setup, run, and test instructions to README"
```

---

### Task 9: Postgres MCP configuration

**Files:**
- Create: `.mcp.json`

**Interfaces:**
- Consumes: `DATABASE_URL` convention from Task 1 (`postgresql://postgres:postgres@localhost:5432/customer_distance`).
- Produces: nothing (tooling config, last task).

- [ ] **Step 1: Create `.mcp.json`**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres:postgres@localhost:5432/customer_distance"
      ]
    }
  }
}
```

- [ ] **Step 2: Verify the MCP server is discoverable**

Ensure `docker compose up -d` and `npm run migrate && npm run seed` have been run at least once (so the `customer_distance` database and table exist), then reload MCP servers in the client (in Claude Code: restart the session or run the MCP reload flow) and confirm a `postgres` MCP server appears and can list the `customers` table.

Expected: the MCP client can query the `customers` table schema and see 15 rows.

- [ ] **Step 3: Commit**

```bash
git add .mcp.json
git commit -m "chore: configure Postgres MCP server for schema/data inspection"
```

---

## Post-implementation checklist

- [ ] `npm test` passes (7 tests: 5 unit + 2 integration)
- [ ] `npm run migrate && npm run seed` run twice in a row leaves exactly 15 rows in `customers`
- [ ] `GET /customers/count` returns `{"count":15}`
- [ ] `GET /customers/by-distance` returns Budapest first at `distanceKm: 0`, ascending order, no external network calls made
- [ ] README steps followed fresh (from `docker compose up -d` through `npm test`) work end-to-end
