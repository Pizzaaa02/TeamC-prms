jest.mock('../../../config', () => ({ env: { ENABLE_FIREBASE_VERIFY: true, GCP_SA_KEY: '{}' } }));
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})), cert: jest.fn(), getApps: jest.fn(() => []),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { getAuth } from 'firebase-admin/auth';
import { verifyFirebaseToken } from '../firebase_auth';

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
