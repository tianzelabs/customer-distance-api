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
function createMockResponse(headersSent = false): Response {
  const res = {} as Response;
  res.headersSent = headersSent;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createMockRequest(): Request {
  return { method: 'GET', originalUrl: '/customers/by-distance' } as Request;
}

describe('errorHandler', () => {
  it('responds with the fixed error shape and HTTP 500', () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new Error('boom');

    errorHandler(err, createMockRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Internal server error' } });
  });

  it('never leaks the raw error message, a stack trace, or the error object itself into the response body', () => {
    const res = createMockResponse();
    const next = vi.fn();
    const err = new Error('password=super-secret connection string leaked here');

    errorHandler(err, createMockRequest(), res, next);

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

    errorHandler(err, createMockRequest(), res, next);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [prefix, loggedErr] = consoleErrorSpy.mock.calls[0];
    expect(String(prefix)).toContain('[api]');
    expect(loggedErr).toBe(err);

    consoleErrorSpy.mockRestore();
  });

  it('handles a non-Error thrown value (e.g. a rejected string) without throwing itself', () => {
    const res = createMockResponse();
    const next = vi.fn();

    expect(() => errorHandler('a plain string rejection', createMockRequest(), res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Internal server error' } });
  });

  it('includes the request method and URL in the server-side log, for traceability', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = createMockResponse();
    const next = vi.fn();

    errorHandler(new Error('boom'), createMockRequest(), res, next);

    const [logMessage] = consoleErrorSpy.mock.calls[0];
    expect(String(logMessage)).toContain('GET');
    expect(String(logMessage)).toContain('/customers/by-distance');

    consoleErrorSpy.mockRestore();
  });

  it('delegates to next(err) instead of writing a response when headers were already sent', () => {
    const res = createMockResponse(true);
    const next = vi.fn();
    const err = new Error('boom after partial response');

    errorHandler(err, createMockRequest(), res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
