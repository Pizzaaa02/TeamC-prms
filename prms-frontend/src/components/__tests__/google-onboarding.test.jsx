import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RoleSelectionRoute, PublicRoute } from '../ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';
import { googleAuthErrorMessage } from '../../utils/googleAuthErrors';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
beforeEach(() => {
  global.localStorage = { getItem: jest.fn(() => null) };
  useAuth.mockReturnValue({ loading: false, isAuthenticated: false, user: null });
});
afterEach(() => { delete global.localStorage; });
const render = Component => renderToStaticMarkup(<MemoryRouter><Component><div>Choose your role</div></Component></MemoryRouter>);
test('guests can choose a registration role', () => {
  expect(render(RoleSelectionRoute)).toContain('Choose your role');
});
test('new signed-in Google users can reach role selection', () => {
  useAuth.mockReturnValue({ loading: false, isAuthenticated: true, user: { role: 'Tenant' } });
  localStorage.getItem.mockReturnValue('true');
  expect(render(RoleSelectionRoute)).toContain('Choose your role');
});
test('returning users cannot reopen onboarding without an onboarding flag', () => {
  useAuth.mockReturnValue({ loading: false, isAuthenticated: true, user: { role: 'Tenant' } });
  expect(render(RoleSelectionRoute)).not.toContain('Choose your role');
});
test('onboarding exception does not expose other guest-only pages to signed-in users', () => {
  useAuth.mockReturnValue({ loading: false, isAuthenticated: true, user: { role: 'Tenant' } });
  localStorage.getItem.mockReturnValue('true');
  expect(render(PublicRoute)).not.toContain('Choose your role');
});
test.each([
  ['auth/popup-blocked', 'Allow pop-ups'],
  ['auth/unauthorized-domain', 'authorized domains'],
  ['auth/operation-not-allowed', 'enable the Google provider'],
  ['auth/popup-closed-by-user', 'cancelled'],
  ['auth/network-request-failed', 'internet connection'],
])('Google error %s explains the required action', (code, message) => {
  expect(googleAuthErrorMessage({ code })).toContain(message);
});
