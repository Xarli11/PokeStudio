import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

// Only on the throwaway hosted runner; never source generated shell text.
const status = execFileSync(
  'pnpm',
  ['--filter', '@pokelab/database', 'exec', 'supabase', 'status', '-o', 'env'],
  { encoding: 'utf8' },
);
const values = Object.fromEntries(
  status.split('\n').flatMap((line) => {
    const match = /^([A-Z_]+)="([^"\r\n]*)"$/.exec(line);
    return match ? [[match[1], match[2]]] : [];
  }),
);
for (const [name, key] of Object.entries({
  SUPABASE_URL: 'API_URL',
  SUPABASE_PUBLISHABLE_KEY: 'ANON_KEY',
  SUPABASE_SECRET_KEY: 'SERVICE_ROLE_KEY',
  INGEST_LOCK_TEST_DB_URL: 'DB_URL',
})) {
  if (!values[key]) throw new Error(`Missing isolated Supabase value: ${key}`);
  if (key.endsWith('URL') && !['localhost', '127.0.0.1'].includes(new URL(values[key]).hostname)) {
    throw new Error('Integration tests must use the ephemeral runner database.');
  }
  console.log(`::add-mask::${values[key]}`);
  appendFileSync(process.env.GITHUB_ENV, `${name}=${values[key]}\n`);
}
