import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { authMiddleware } from './auth';
import { requireRole } from './requireRole';

function createHarness() {
  const app = express();
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });
  app.get('/admin-only', authMiddleware, requireRole('admin', 'superadmin'), (req, res) => {
    res.json({ ok: true });
  });
  return app;
}

function token(role: 'user' | 'admin' | 'superadmin') {
  return jwt.sign({ id: 'user-1', email: 'qa@laisla.test', role }, env.JWT_SECRET, {
    expiresIn: '5m'
  });
}

describe('authentication and role middleware', () => {
  const app = createHarness();

  it('rejects a missing bearer token', async () => {
    const response = await request(app).get('/protected');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token de acceso requerido' });
  });

  it('rejects an invalid bearer token', async () => {
    const response = await request(app).get('/protected').set('Authorization', 'Bearer invalid');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token inválido o expirado' });
  });

  it('attaches a valid token payload to the request', async () => {
    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token('user')}`);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: 'user-1', role: 'user' });
  });

  it('forbids a valid user without an allowed role', async () => {
    const response = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token('user')}`);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'No tienes permisos para acceder a esta sección' });
  });

  it.each(['admin', 'superadmin'] as const)('allows the %s role', async (role) => {
    const response = await request(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${token(role)}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
