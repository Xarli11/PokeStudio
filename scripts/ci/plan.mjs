export const migrationDirectory = 'packages/database/supabase/migrations/';

export function planMigrations(files, applied) {
  const versions = files
    .map((file) => {
      const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
      if (!match) throw new Error(`Invalid migration filename: ${file}`);
      return match[1];
    })
    .sort();
  if (new Set(versions).size !== versions.length) throw new Error('Duplicate migration version.');
  const remote = [...applied].sort();
  if (
    new Set(remote).size !== remote.length ||
    remote.some((version, i) => version !== versions[i])
  ) {
    throw new Error('Migration history is not a canonical prefix; manual reconciliation required.');
  }
  return versions.slice(remote.length);
}

export function needsIngestion(
  paths,
  { target = 'cloud-dev', force = false, bootstrap = false, pending = [] } = {},
) {
  if (!['cloud-dev', 'production'].includes(target)) throw new Error('Unknown ingestion target.');
  return (
    force ||
    bootstrap ||
    pending.length > 0 ||
    paths.some(
      (path) =>
        path === 'pnpm-lock.yaml' ||
        path === 'packages/pokemon-data/package.json' ||
        path.startsWith(migrationDirectory) ||
        (/^packages\/pokemon-data\/(src|scripts)\//.test(path) && !/\.(test|spec)\./.test(path)) ||
        path === `scripts/ingest-${target}.sh`,
    )
  );
}

export function assertAppendOnly(changes) {
  for (const [status, path] of changes) {
    if (path.startsWith(migrationDirectory) && status !== 'A') {
      throw new Error(`Historical migrations are immutable: ${path}`);
    }
  }
}
