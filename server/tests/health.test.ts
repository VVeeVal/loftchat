import { describe, it, expect } from 'vitest';
import supertest from 'supertest';

describe('health endpoint', () => {
  it('returns ok status', async () => {
    const { buildApp } = await import('../src/app.js');
    const app = await buildApp();
    await app.ready();

    const res = await supertest(app.server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });

    await app.close();
  });
});
