// Isolated browser QA server: never opens the developer's prisma/dev.db.
// Run from prms-backend: node -r ts-node/register/transpile-only scripts/auth-browser-server.ts
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

async function main() {
  const repo = resolve(__dirname, '..');
  const require = createRequire(__filename);
  const temp = mkdtempSync(join(tmpdir(), 'prms-auth-browser-'));
  mkdirSync(join(temp, 'prisma'));
  const Database = require('better-sqlite3');
  const database = new Database(join(temp, 'prisma/dev.db'));
  database.exec(readFileSync(join(repo, 'prisma/migrations/20260612211110_init/migration.sql'), 'utf8'));
  database.close();
  process.chdir(temp);
  Object.assign(process.env, {
    PORT: '3511', NODE_ENV: 'test', JWT_SECRET: 'browser-test-access-only',
    JWT_REFRESH_SECRET: 'browser-test-refresh-only', ENABLE_FIREBASE_VERIFY: 'false',
    CORS_ORIGIN: 'http://127.0.0.1:5176',
  });
  const { prisma } = require(join(repo, 'src/db.ts'));
  for (const name of ['Tenant', 'Landlord', 'Agent', 'Admin']) await prisma.role.create({ data: { name } });
  const { registerUser } = require(join(repo, 'src/modules/auth/service_auth.ts'));
  await registerUser('browser-test@example.test', 'Browser-test-123!', 'Browser Test', '', 'Tenant');
  require(join(repo, 'src/app.ts'));
  console.log(`Disposable QA database: ${temp}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
