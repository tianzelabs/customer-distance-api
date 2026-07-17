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
