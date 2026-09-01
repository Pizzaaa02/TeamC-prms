# Task #11 — Authentication & Registration Testing

Test date: 31 August 2026. Scope: registration, email login, Google sign-in, invalid authentication, logout and protected routes, as listed in the supplied task image.

**Result: local authentication checks pass after fixes. Live Google sign-in remains pending; this is not full production sign-off.**

## Evidence and test environment

- **58 automated tests passed:** 37 authentication tests across two new suites, plus 21 existing property tests. See [machine-readable results](test-results.json).
- Authentication integration tests use real HTTP requests, Express validators/controllers, Prisma with a newly created SQLite database, bcrypt and JWTs. They exercise the production authentication router and middleware, not the entire application server. Firebase verification and audit writing are mocked; those external services are not certified by these tests.
- Five Firebase boundary tests simulate Firebase SDK responses and check verified email, Google provider, revocation-check invocation and verification rejection. No live Google token is represented as tested.
- Browser checks use the real frontend and full backend with a separate disposable SQLite database, frontend port 5176 and backend port 3511. Only synthetic accounts ending in `@example.test` were used. Google verification was explicitly disabled in this isolated browser fixture; its Google endpoint fails closed.
- Existing changes to `.gitignore` and `prms-backend/prisma/dev.db` were present before testing and were left untouched by this work. No migrations or test accounts were applied to the developer database.

## Acceptance matrix

| Scenario | Expected result | Observed result / evidence |
|---|---|---|
| Register Tenant, Landlord and Agent | Account created with selected role; password hashed | PASS: automated HTTP/SQLite tests for each role |
| Register multiple local accounts | Unique identities; no collision | PASS: two distinct registrations |
| Invalid registration | Reject invalid email, empty/short password and unauthorized role | PASS: HTTP 400, no account created |
| Duplicate email | Reject and show useful error | PASS: HTTP 400 and browser-visible error; [screenshot](screenshots/duplicate-registration.png) |
| Password confirmation mismatch | Stop submission and explain mismatch | PASS: browser displayed “Passwords do not match” |
| Complete registration | Reach usable login page | PASS after fixing loading/guard race; [screenshot](screenshots/registration-success.png) |
| Valid email login | Issue tokens and open correct portal | PASS: automated checks for all public roles; browser Tenant login and newly registered Tenant login; [screenshot](screenshots/valid-login.png) |
| Invalid email login | Reject unknown account, wrong password, malformed/missing fields, suspended account | PASS: HTTP 400/401 as appropriate; browser wrong-password feedback; [screenshot](screenshots/invalid-login.png) |
| Session restoration | Reload retains valid authentication | PASS: browser remained in Tenant portal after reload |
| Anonymous protected pages | Redirect to login without protected content | PASS: browser checked Tenant, Admin, Landlord, Agent dashboards and property editor |
| Wrong-role page/API | Reject access outside assigned role | PASS: browser Tenant redirected away from Admin dashboard; API Tenant denied with 403, Admin permitted |
| Invalid access token | Reject missing, malformed, wrong-signature, expired, missing-userId and unknown-user tokens | PASS: HTTP 401 |
| Suspended user | Reject protected access and refresh | PASS: HTTP 401 |
| Refresh rotation | Issue new token; reject previous token replay | PASS: sequential rotation/replay tested, including immediate rotation |
| Logout | Clear browser session and revoke refresh token | PASS: browser returned to login; revisiting protected pages redirected to login; refresh after logout returned 401; [screenshot](screenshots/protected-after-logout.png) |
| Google new/returning account | Use verified identity and return correct new-user flag | PASS with simulated Firebase verification; HTTP/SQLite account creation and returning-account behavior tested |
| Google account linking | Link matching local account, reject conflicting identity and suspension | PASS with simulated Firebase verification |
| Forged browser email/name | Must not control account identity | PASS: server uses verified token claims |
| Google disabled/missing/invalid token | Must not authenticate | PASS: disabled configuration returns 503; missing/invalid tokens rejected |
| Real Google popup and onboarding | Complete provider login and correct application navigation | **PENDING:** requires configured Firebase test environment and a Google test account; popup cancellation feedback was implemented but not manually exercised |

## Defects fixed

1. Registration set the global loading flag, unmounted its form and did not reliably return to a usable login page. Registration now keeps the form mounted; login clears onboarding state after navigation. The login-only registration gate was removed so a pending signup cannot block existing-account login. Registration still requires selecting a role, and server role validation remains enforced.
2. Failed registration cleared its own error. It now keeps the failure message visible.
3. Tenant, Landlord and Agent login destinations used `/dashboard`, but only their index routes existed. Added the missing dashboard routes. The browser now renders Tenant dashboard content rather than an empty shell.
4. The public property-edit URL did not use a page guard. It now requires Admin or Landlord, matching the update API's role restriction. Role-restricted pages also reject a missing role.
5. Google login could authenticate from an arbitrary supplied email when verification was disabled, and account linking trusted the supplied email even when a token was verified. It now fails closed without verification and derives identity exclusively from signed claims. Firebase checks revocation and requires a verified Google email/provider.
6. Google popup failures were console-only. Login now shows an error and prevents repeated clicks while the popup attempt is pending.
7. Refresh tokens could repeat within one second, and bcrypt's input truncation meant hashing the JWT directly did not reliably distinguish tokens. Refresh tokens now have random JWT IDs and are SHA-256 digested before bcrypt. Suspended users cannot refresh.
8. Access tokens without a valid user ID could reach the database lookup, and expired-token errors were caught by the generic token-error branch. Both are now handled as authentication failures.

## Remaining limitations and release checks

- **Real Google sign-in is unverified.** Use a non-production Firebase project with Google enabled, correct authorized domains and backend credentials. Set `ENABLE_FIREBASE_VERIFY=true` and securely provision `GCP_SA_KEY`; do not paste private keys into the report. Manually check new-account onboarding, returning-account login, cancellation, logout and account switching. Do not mark task #11 fully accepted until this evidence is added.
- Logout revokes the refresh token and clears the browser session. Already-issued access JWTs remain valid until their configured expiry (default one hour). Immediate server-side access-token revocation is not implemented or claimed by these results.
- Existing stored refresh hashes use the old format. After this update, old refresh tokens will be rejected and those sessions must sign in again. Password hashes and account data are unchanged.
- The backend production build reports **16 type errors in unchanged booking, customizer, favorite, maintenance, notification, payment and theme modules**. These are outside the authentication changes and remain unresolved. The authentication suites compile and pass.
- Frontend production build passes with a large-bundle warning. Lint passes for the five changed frontend files. A whole-repository lint pass is not claimed.
- Browser role-login testing covered Tenant. Landlord and Agent dashboard routes were added and compile, but their authenticated browser dashboards were not separately exercised. Backend registration/login for both roles passed.
- The dashboard screenshot contains existing sample rental/payment content. It is evidence of authenticated page rendering, not financial-data correctness.
- These are functional and regression checks, not a comprehensive security audit, concurrent-session test or load test.

## Repeat the checks

From `prms-backend`:

```powershell
npm.cmd run test:auth
npm.cmd test -- --json --outputFile=../docs/auth-testing/test-results.json
```

The integration suite creates its own temporary database from the committed migration, seeds only roles, and removes that database after the run. No `.env` credentials are needed for automated tests.

For isolated browser QA, start this server from `prms-backend`:

```powershell
node -r ts-node/register/transpile-only scripts/auth-browser-server.ts
```

In a separate terminal, from `prms-frontend`:

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:3511'
npm.cmd run dev -- --host 127.0.0.1 --port 5176
```

Open `http://127.0.0.1:5176/login`. The isolated fixture creates `browser-test@example.test` with synthetic password `Browser-test-123!`. These credentials are test-only and must never be used in production. Each fixture run creates a fresh database and prints its temporary directory. Stop both servers when finished; the browser fixture leaves its temporary database for inspection.

For browser registration, select a role, enter a new synthetic email and matching password, submit, and verify login → portal → reload → logout → protected-page rejection. Repeat invalid password, duplicate registration and password-mismatch checks. The five PNGs in `screenshots/` record the completed local run.
