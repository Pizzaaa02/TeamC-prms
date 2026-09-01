import express from 'express';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Only external identity and audit I/O are simulated. Database, password hashing,
// JWT verification, validation, controllers and HTTP middleware are real.
jest.mock('../../../config', () => ({ env: {
  JWT_SECRET: 'auth-test-access-secret', JWT_REFRESH_SECRET: 'auth-test-refresh-secret',
  JWT_EXPIRY: '1h', JWT_REFRESH_EXPIRY: '7d', ENABLE_FIREBASE_VERIFY: true,
} }));
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
jest.mock('../firebase_auth', () => ({ verifyFirebaseToken: jest.fn() }));
jest.mock('../../admin/service_audit', () => ({ recordAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../db', () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  return { prisma: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.AUTH_TEST_DB }) }) };
});

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let prisma: any;
let env: any;
let verifyFirebaseToken: jest.Mock;
let server: Server;
let base: string;
let temp: string;
const signup = { email: 'auth-test@example.test', password: 'Test-pass-123!', full_name: 'Auth Test', role: 'Tenant' };

async function request(path: string, body?: unknown, token?: string, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as any };
}
async function register(overrides = {}) {
  return request('/auth/register', { ...signup, ...overrides });
}

beforeAll(async () => {
  temp = mkdtempSync(join(tmpdir(), 'prms-auth-test-'));
  process.env.AUTH_TEST_DB = join(temp, 'auth.db');
  const Database = require('better-sqlite3');
  const sqlite = new Database(process.env.AUTH_TEST_DB);
  sqlite.exec(readFileSync(join(process.cwd(), 'prisma/migrations/20260612211110_init/migration.sql'), 'utf8'));
  sqlite.close();
  prisma = require('../../../db').prisma;
  env = require('../../../config').env;
  verifyFirebaseToken = require('../firebase_auth').verifyFirebaseToken;
  for (const name of ['Tenant', 'Landlord', 'Agent', 'Admin']) await prisma.role.create({ data: { name } });
  const app = express();
  app.use(express.json());
  app.use('/auth', require('../routes_auth').default);
  app.get('/admin-test', require('../../../middleware/auth').authenticate, require('../../../middleware/rbac').adminOnly,
    (_req, res) => res.json({ success: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
beforeEach(async () => {
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  verifyFirebaseToken.mockReset();
  env.ENABLE_FIREBASE_VERIFY = true;
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (prisma) await prisma.$disconnect();
  if (temp) rmSync(temp, { recursive: true, force: true });
  delete process.env.AUTH_TEST_DB;
});

describe('Registration and email login', () => {
  test.each(['Tenant', 'Landlord', 'Agent'])('registers and logs in a %s with hashed password', async role => {
    const created = await register({ role });
    expect(created.status).toBe(201);
    const saved = await prisma.user.findUnique({ where: { email: signup.email } });
    expect(saved.passwordHash).not.toBe(signup.password);
    expect(await bcrypt.compare(signup.password, saved.passwordHash)).toBe(true);
    const login = await request('/auth/login', signup);
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe(role);
    expect(login.body.data.user.passwordHash).toBeUndefined();
    const me = await request('/auth/me', undefined, login.body.data.tokens.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(signup.email);
    expect(me.body.data.refreshToken).toBeUndefined();
  });
  test('supports multiple separate password registrations', async () => {
    expect((await register()).status).toBe(201);
    expect((await register({ email: 'second@example.test' })).status).toBe(201);
  });
  test('rejects duplicate email', async () => {
    await register();
    expect((await register()).status).toBe(400);
  });
  test.each([{ email: 'invalid' }, { password: '123' }, { password: '' }, { role: 'Admin' }, { role: 'Unknown' }])('rejects invalid registration %j', async data => {
    expect((await register(data)).status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });
  test.each([{ email: 'invalid', password: 'x' }, { email: signup.email }, {}])('rejects invalid login input %j', async data => {
    expect((await request('/auth/login', data)).status).toBe(400);
  });
  test('rejects unknown email, wrong password and suspended accounts', async () => {
    expect((await request('/auth/login', signup)).status).toBe(401);
    await register();
    expect((await request('/auth/login', { ...signup, password: 'wrong' })).status).toBe(401);
    await prisma.user.update({ where: { email: signup.email }, data: { is_active: false } });
    expect((await request('/auth/login', signup)).status).toBe(401);
  });
});

describe('Protected routes and sessions', () => {
  test.each([undefined, 'malformed', jwt.sign({ userId: 'missing' }, 'wrong-secret'),
    jwt.sign({ userId: 'missing' }, 'auth-test-access-secret', { expiresIn: -1 }),
    jwt.sign({}, 'auth-test-access-secret'), jwt.sign({ userId: 'missing' }, 'auth-test-access-secret')])('rejects missing, invalid, expired or unknown-user access (%#)', async token => {
    expect((await request('/auth/me', undefined, token)).status).toBe(401);
  });
  test('rejects suspended-user access and refresh', async () => {
    const result = await register();
    await prisma.user.update({ where: { email: signup.email }, data: { is_active: false } });
    expect((await request('/auth/me', undefined, result.body.data.tokens.accessToken)).status).toBe(401);
    expect((await request('/auth/refresh', { refreshToken: result.body.data.tokens.refreshToken })).status).toBe(401);
  });
  test('denies tenant access to admin route; permits admin', async () => {
    const result = await register();
    const token = result.body.data.tokens.accessToken;
    expect((await request('/admin-test', undefined, token)).status).toBe(403);
    await prisma.userRole.deleteMany();
    const role = await prisma.role.findUnique({ where: { name: 'Admin' } });
    await prisma.userRole.create({ data: { userId: result.body.data.user.id, roleId: role.id } });
    expect((await request('/admin-test', undefined, token)).status).toBe(200);
  });
  test('rotates refresh token and rejects replay, including within the same second', async () => {
    const result = await register();
    const old = result.body.data.tokens.refreshToken;
    const refreshed = await request('/auth/refresh', { refreshToken: old });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.tokens.refreshToken).not.toBe(old);
    expect((await request('/auth/refresh', { refreshToken: old })).status).toBe(401);
    expect((await request('/auth/refresh', { refreshToken: refreshed.body.data.tokens.refreshToken })).status).toBe(200);
  });
  test('logout revokes refresh and requires authentication', async () => {
    expect((await request('/auth/logout', {})).status).toBe(401);
    const result = await register();
    const { accessToken, refreshToken } = result.body.data.tokens;
    expect((await request('/auth/logout', {}, accessToken)).status).toBe(200);
    expect((await request('/auth/refresh', { refreshToken })).status).toBe(401);
    expect((await prisma.user.findUnique({ where: { email: signup.email } })).refreshToken).toBeNull();
  });
  test.each([{}, { refreshToken: 'invalid' }, { refreshToken: jwt.sign({ userId: 'x' }, 'auth-test-refresh-secret', { expiresIn: -1 }) }])('rejects invalid refresh input %j', async data => {
    expect([400, 401]).toContain((await request('/auth/refresh', data)).status);
  });
});

describe('Google sign-in (Firebase verification boundary simulated)', () => {
  test('fails closed when verification is disabled', async () => {
    env.ENABLE_FIREBASE_VERIFY = false;
    expect((await request('/auth/google', { email: signup.email })).status).toBe(503);
    expect(await prisma.user.count()).toBe(0);
  });
  test('rejects missing and invalid Google tokens', async () => {
    expect((await request('/auth/google', { email: signup.email })).status).toBe(400);
    verifyFirebaseToken.mockRejectedValue(new Error('Invalid Firebase token'));
    expect((await request('/auth/google', { idToken: 'invalid' })).status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });
  test('creates new Google user from verified claims and then recognizes returning user', async () => {
    verifyFirebaseToken.mockResolvedValue({ uid: 'google-1', email: 'verified@example.test', name: 'Verified User' });
    const result = await request('/auth/google', { idToken: 'test-token', email: 'forged@example.test', displayName: 'Forged' });
    expect(result.status).toBe(200);
    expect(result.body.data.isNewUser).toBe(true);
    expect(result.body.data.user.email).toBe('verified@example.test');
    expect(result.body.data.user.full_name).toBe('Verified User');
    expect((await request('/auth/me', undefined, result.body.data.tokens.accessToken)).status).toBe(200);
    expect((await request('/auth/google', { idToken: 'test-token' })).body.data.isNewUser).toBe(false);
    expect(await prisma.user.count()).toBe(1);
    expect((await request('/auth/login', { email: 'verified@example.test', password: signup.password })).status).toBe(401);
  });
  test('links matching local account and rejects conflicting Google identity', async () => {
    const local = await register();
    verifyFirebaseToken.mockResolvedValue({ uid: 'google-1', email: signup.email });
    const linked = await request('/auth/google', { idToken: 'test-token' });
    expect(linked.status).toBe(200);
    expect(linked.body.data.user.id).toBe(local.body.data.user.id);
    verifyFirebaseToken.mockResolvedValue({ uid: 'google-2', email: signup.email });
    expect((await request('/auth/google', { idToken: 'other-token' })).status).toBe(400);
  });
  test('does not link or issue tokens for a suspended local account', async () => {
    await register();
    const prior = await prisma.user.update({ where: { email: signup.email }, data: { is_active: false } });
    verifyFirebaseToken.mockResolvedValue({ uid: 'google-1', email: signup.email });
    expect((await request('/auth/google', { idToken: 'test-token' })).status).toBe(400);
    expect((await prisma.user.findUnique({ where: { email: signup.email } })).firebase_uid).toBe(prior.firebase_uid);
  });
});
