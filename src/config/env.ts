/**
 * Single place environment variables are read (AD-9). Every consumer
 * (db/pool.ts, seed.ts, and future app.ts/server.ts/integration tests)
 * imports `env` (or `requireTestDatabaseUrl()`) from here — no other
 * module reads `process.env` directly.
 *
 * `dotenv` loads a repo-root `.env` file (if present) into
 * `process.env` before anything below reads it. This keeps the "single
 * place env vars are read" invariant intact (the loading also happens
 * here, not scattered across npm scripts/CLI flags) while working
 * uniformly across every entrypoint this project has (`tsx src/seed.ts`,
 * `vitest run`, and the future compiled server). See Story 1.4 Dev
 * Notes for the full rationale (`[ASSUMPTION]`).
 */
import { config as loadDotenv } from 'dotenv';

loadDotenv();

const DEFAULT_PORT = 3000;

export interface Env {
  /** Connection string for the app/migration/seed DB (customer_distance). Required, fail-fast. */
  databaseUrl: string;
  /** HTTP port. Optional, defaults to 3000 if unset. */
  port: number;
}

// Note: TEST_DATABASE_URL is deliberately NOT exposed on `env` — the only
// sanctioned way to read it is requireTestDatabaseUrl() below. Putting it on
// `env` too would let a caller bypass the fail-stop/never-DATABASE_URL
// guarantees just by reading the field directly (AD-9).

function requireEnv(name: string, extraHint?: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    const hint = extraHint ? ` ${extraHint}` : '';
    throw new Error(
      `[config] Missing required environment variable: ${name}.${hint} Set it in your shell environment or in a repo-root .env file (see .env.example).`,
    );
  }
  return value;
}

/**
 * Validates a Postgres connection string's shape (protocol + host present).
 * Never interpolates the raw value into a thrown error — it may contain a
 * password, and error messages get logged (Consistency Conventions: logs
 * must never contain a password or connection string).
 */
function validatePostgresUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[config] ${name} is not a valid URL (value withheld from this message).`);
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(
      `[config] ${name} must be a postgres:// or postgresql:// connection string, got protocol "${parsed.protocol}"`,
    );
  }
  if (parsed.hostname === '') {
    throw new Error(`[config] ${name} is missing a host (value withheld from this message).`);
  }
  return value;
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PORT;
  }
  // Reject scientific/hex/octal numeric literals (e.g. "1e2", "0x1f") that
  // `Number()` would otherwise silently accept as valid ports.
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`[config] PORT must be a plain integer between 1 and 65535, got "${raw}"`);
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`[config] PORT must be an integer between 1 and 65535, got "${raw}"`);
  }
  return parsed;
}

export const env: Env = {
  databaseUrl: validatePostgresUrl('DATABASE_URL', requireEnv('DATABASE_URL')),
  port: parsePort(process.env.PORT),
};

/**
 * Returns TEST_DATABASE_URL, fail-stop if unset, invalid, or equal to
 * DATABASE_URL. Integration test setup MUST call this — never fall back to
 * `env.databaseUrl` (AD-9: integration tests must never silently run
 * against the dev DB).
 */
export function requireTestDatabaseUrl(): string {
  const value = requireEnv(
    'TEST_DATABASE_URL',
    'Integration tests must never fall back to DATABASE_URL (AD-9).',
  );
  const validated = validatePostgresUrl('TEST_DATABASE_URL', value);
  if (validated === env.databaseUrl) {
    throw new Error(
      '[config] TEST_DATABASE_URL must not be the same as DATABASE_URL (AD-9) — ' +
        'integration tests would TRUNCATE/mutate the dev database.',
    );
  }
  return validated;
}
