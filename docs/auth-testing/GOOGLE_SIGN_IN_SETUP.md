# Google sign-in follow-up - 31 August 2026

## Confirmed local blocker

The backend `.env` currently has `ENABLE_FIREBASE_VERIFY=false` and an empty `GCP_SA_KEY`. The Firebase project ID is `project-prms-149c6`. The frontend uses that same project through its existing fallback Firebase web configuration.

The secure Google endpoint deliberately rejects requests while verification is disabled. This replaced an unsafe development shortcut that accepted an arbitrary email without verifying Google identity. Do not restore that shortcut.

The local backend was not running on port 3500 at the time of the follow-up check. A successful live Google sign-in has not been observed. Automated Google tests simulate Firebase; they do not prove that the project's provider, authorized domains or credentials are configured correctly.

## Code fixes in this follow-up

- Removed duplicate, invalid Firebase initialization from the application server. Both verification paths now use the same credential-aware initializer and preserve revocation checks.
- Added support for `GOOGLE_APPLICATION_CREDENTIALS`, so a service-account file can stay outside the repository. Existing inline `GCP_SA_KEY` configuration is still supported.
- Allowed authenticated new Google users into the role-selection page. Other guest-only pages still redirect signed-in users.
- Made role selection replace the old role association, instead of keeping Tenant as the first role. The frontend reads the canonical role from `/auth/me` after saving.
- Failed role updates retain onboarding state and display an error instead of pretending to succeed.
- Legacy `dev-<email>` identity placeholders can be linked to a real Google UID only after that exact email is verified. Conflicting real Google links remain rejected.
- Added specific messages for blocked pop-ups, unauthorized domains, disabled Google provider, cancelled sign-in and network failure.

## Configure securely

The Firebase project owner must provide an authorized backend service-account credential through a secure channel. Do not paste it into chat, put it in the frontend, attach it to the report, or commit it to GitHub.

1. Confirm the credential belongs to `project-prms-149c6` and has the permissions required for Firebase Authentication verification and revocation checks.
2. Store the JSON file outside this repository. In `prms-backend/.env`, set the following, replacing the example path with the real local path:

```dotenv
ENABLE_FIREBASE_VERIFY=true
FIREBASE_PROJECT_ID=project-prms-149c6
GOOGLE_APPLICATION_CREDENTIALS=C:/secure-location/firebase-service-account.json
GCP_SA_KEY=
```

An existing correctly configured `GCP_SA_KEY` can be used instead. When both are present, `GCP_SA_KEY` takes precedence. The placeholder path above is not an installed credential.

3. In Firebase Authentication, confirm that Google is enabled as a sign-in provider and that the exact website host used for testing is authorized. `localhost` and `127.0.0.1` are different hosts; use the authorized one.
4. Start or restart the backend so it reads the updated environment, then start the frontend. Its current local API address is `http://localhost:3500`.
5. Use a designated Google test account to check the popup, new-user role selection, returning-user login, dashboard refresh, logout and account switching. If it fails, record the visible error message, but never copy ID tokens or credentials into screenshots or chat.

The existing test browser fixture intentionally disables Firebase verification and therefore must not be used to certify live Google sign-in.

## Regression checks

Run `npm.cmd test` from `prms-backend` and `npm.cmd run test:auth` from `prms-frontend`. The frontend tests reuse the backend's existing Jest/ts-jest installation, so install both projects' dependencies before running them. Tests cover verified identity, credential initialization, legacy account linking, role persistence and page-guard behavior. Frontend build and lint of the changed application files also pass; the earlier unrelated backend build errors remain outside this follow-up.

The original Word report records the earlier test run. This follow-up does not change its live-Google status: still pending credentials and a real provider sign-in.

## Official reference

- Firebase Admin setup: https://firebase.google.com/docs/admin/setup
- Session revocation checks: https://firebase.google.com/docs/auth/admin/manage-sessions
