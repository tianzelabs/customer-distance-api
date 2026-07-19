import { defineConfig } from 'vitest/config';

/**
 * `fileParallelism: false` — multiple integration test files
 * (test/integration/seed.test.ts, test/integration/customersCount.test.ts)
 * share ONE real Postgres table (`customers` in the `TEST_DATABASE_URL`
 * database, AD-9) and each independently truncates it per-test for
 * isolation/repeatability. Vitest's default (test files run in parallel
 * workers) lets one file's TRUNCATE/INSERT interleave with another
 * file's assertions against the same live table, causing flaky,
 * non-deterministic failures unrelated to the code under test.
 * Serializing file execution removes the cross-file race without
 * changing any individual test's own TRUNCATE-per-test strategy. The
 * suite is small (well under 100 tests as of Story 2.3), so the
 * performance cost of sequential file execution is negligible.
 *
 * Note: this only serializes ACROSS files, not within one — Vitest's
 * default is already non-concurrent within a file (no test in this repo
 * uses `it.concurrent`), so this setting alone is sufficient today, but
 * a future `it.concurrent` block sharing the customers table would
 * reopen the same race this config closes.
 */
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
