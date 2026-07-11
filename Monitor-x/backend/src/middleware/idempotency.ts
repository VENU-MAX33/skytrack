import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { IdempotencyKey } from '../models/IdempotencyKey.js';

/**
 * Optional idempotency for non-idempotent POSTs. When a request carries an
 * `Idempotency-Key` header, the first request reserves the key (a unique index
 * makes the reservation atomic, so concurrent duplicates can't both proceed) and
 * its response is recorded; any later request with the same key replays that
 * stored response instead of running the handler again. Requests without the
 * header behave exactly as before.
 */
export function idempotent(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.header('Idempotency-Key');
    if (!rawKey) {
      next();
      return;
    }
    const key = `${req.method}:${req.baseUrl}${req.path}:${rawKey}`;

    // Reserve the key. A duplicate-key error means we've seen it before.
    try {
      await IdempotencyKey.create({ key });
    } catch {
      const existing = await IdempotencyKey.findOne({ key });
      if (existing?.completed) {
        res.status(existing.statusCode).json(existing.responseBody);
      } else {
        // Reserved but not finished — a concurrent request is still in flight.
        res.status(409).json({ error: 'A request with this Idempotency-Key is already in progress' });
      }
      return;
    }

    // First time through: capture the response so a later replay can return it.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      void IdempotencyKey.updateOne(
        { key },
        { statusCode: res.statusCode, responseBody: body, completed: true }
      ).catch(() => {});
      return originalJson(body);
    };
    next();
  };
}
