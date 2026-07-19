import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler.js';

/**
 * Unit-level test: calls the middleware function directly with fake
 * req/res/next objects — no HTTP layer, no Express app involved. This
 * isolates AC #4's exact response-shape/status/logging contract from the
 * app-wiring concern (covered separately, end-to-end, by
 * test/integration/app.test.ts).
 */
function createMockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('responds with the fixed error shape and HTTP 500', () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new Error('boom');

    errorHandler(err, {} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Internal server error' } });
  });

  it('never leaks the raw error message, a stack trace, or the error object itself into the response body', () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new Error('password=super-secret connection string leaked here');

    errorHandler(err, {} as Request, res, next);

    const jsonPayload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const serialized = JSON.stringify(jsonPayload);
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('boom');
    expect(jsonPayload).toEqual({ error: { message: 'Internal server error' } });
  });

  it('logs the real error server-side via console.error with the [api] prefix', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = createMockResponse();
    const next = vi.fn();
    const err = new Error('db connection refused');

    errorHandler(err, {} as Request, res, next);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [prefix, loggedErr] = consoleErrorSpy.mock.calls[0];
    expect(String(prefix)).toContain('[api]');
    expect(loggedErr).toBe(err);

    consoleErrorSpy.mockRestore();
  });

  it('handles a non-Error thrown value (e.g. a rejected string) without throwing itself', () => {
    const res = createMockResponse();
    const next = vi.fn();

    expect(() => errorHandler('a plain string rejection', {} as Request, res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Internal server error' } });
  });
});
