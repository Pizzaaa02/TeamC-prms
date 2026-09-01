jest.mock('../../../config', () => ({ env: { ENABLE_FIREBASE_VERIFY: true, GCP_SA_KEY: '{}' } }));
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})), cert: jest.fn(() => ({ type: 'certificate' })),
  applicationDefault: jest.fn(() => ({ type: 'application-default' })), getApps: jest.fn(() => []),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { getAuth } from 'firebase-admin/auth';
import { verifyFirebaseToken } from '../firebase_auth';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { env } from '../../../config';

const verifyIdToken = jest.fn();
beforeEach(() => {
  verifyIdToken.mockReset();
  (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
});
const claims = { uid: 'google-id', email: 'Verified@Example.test', name: 'Test User', email_verified: true,
  firebase: { sign_in_provider: 'google.com' } };
test('validates revocation and returns only verified Google identity claims', async () => {
  verifyIdToken.mockResolvedValue(claims);
  await expect(verifyFirebaseToken('sample-token')).resolves.toEqual({ uid: 'google-id', email: 'verified@example.test', name: 'Test User' });
  expect(verifyIdToken).toHaveBeenCalledWith('sample-token', true);
});
test.each([{ email: undefined }, { email_verified: false }, { firebase: { sign_in_provider: 'password' } }])('rejects unsuitable identity claims %j', async override => {
  verifyIdToken.mockResolvedValue({ ...claims, ...override });
  await expect(verifyFirebaseToken('sample-token')).rejects.toThrow('A verified Google account is required');
});
test('rejects invalid, expired or revoked tokens rejected by Firebase', async () => {
  verifyIdToken.mockRejectedValue(new Error('Firebase rejected token'));
  await expect(verifyFirebaseToken('sample-token')).rejects.toThrow('Firebase rejected token');
});

describe('Firebase initialization', () => {
  function initialize(overrides: Record<string, unknown>) {
    Object.assign(env, { ENABLE_FIREBASE_VERIFY: true, GCP_SA_KEY: '', GOOGLE_APPLICATION_CREDENTIALS: undefined, FIREBASE_PROJECT_ID: 'test-project' }, overrides);
    let result: unknown;
    jest.isolateModules(() => { result = require('../firebase_auth').getFirebaseApp(); });
    return result;
  }
  beforeEach(() => {
    (initializeApp as jest.Mock).mockClear();
    (getApps as jest.Mock).mockReturnValue([]);
  });
  test('converts inline service-account JSON to a Firebase credential', () => {
    initialize({ GCP_SA_KEY: '{"project_id":"test-project"}' });
    expect(cert).toHaveBeenCalledWith({ project_id: 'test-project' });
    expect(initializeApp).toHaveBeenCalledWith({ credential: { type: 'certificate' }, projectId: 'test-project' });
  });
  test('supports the standard service-account file environment variable', () => {
    initialize({ GOOGLE_APPLICATION_CREDENTIALS: '/test-only/service-account.json' });
    expect(applicationDefault).toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalledWith({ credential: { type: 'application-default' }, projectId: 'test-project' });
  });
  test('missing credentials fail with an actionable error', () => {
    expect(() => initialize({})).toThrow('Configure GCP_SA_KEY or GOOGLE_APPLICATION_CREDENTIALS');
    expect(initializeApp).not.toHaveBeenCalled();
  });
  test('disabled verification cannot initialize Firebase', () => {
    expect(() => initialize({ ENABLE_FIREBASE_VERIFY: false })).toThrow('Firebase verification disabled');
  });
});
