/**
 * Single shared `pg` Pool module (AD-3). This is the ONLY place in the
 * repo that calls `new Pool(...)` — every DB consumer (the seed
 * entrypoint, future repositories, future integration tests) obtains
 * its connection exclusively through this module's `pool` singleton or
 * `createPool()` factory.
 *
 * Test-DB isolation (AD-9): integration tests must NOT use the `pool`
 * singleton below (which is bound to `DATABASE_URL`, the dev DB).
 * Instead they call `createPool(requireTestDatabaseUrl())` — the same
 * factory, pointed at `TEST_DATABASE_URL` — so a second `new Pool(...)`
 * call site never appears anywhere else in the codebase.
 */
import { Pool, type PoolConfig } from 'pg';
import { env } from '../config/env.js';

export function createPool(
  connectionString: string,
  overrides: Omit<PoolConfig, 'connectionString'> = {},
): Pool {
  return new Pool({ connectionString, ...overrides });
}

/** Shared Pool for the app/seed, bound to DATABASE_URL (dev DB). */
export const pool: Pool = createPool(env.databaseUrl);
