import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { targetFor } from './target.mjs';

// Transitional: the GitHub repository is being renamed PokeStudio -> PokeLab. Both exact names are
// trusted until the rename lands; then drop 'Xarli11/PokeStudio' (docs/engineering/RENAME_POKELAB.md).
const TRUSTED_REPOSITORIES = new Set(['Xarli11/PokeStudio', 'Xarli11/PokeLab']);

export async function github(path) {
  if (!process.env.GITHUB_TOKEN) throw new Error('Missing GitHub read token.');
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`GitHub audit failed (${response.status}); refusing to guess.`);
  return response.json();
}

export function assertProtection(environment, branches, production) {
  if (
    !environment.deployment_branch_policy?.custom_branch_policies ||
    branches.branch_policies?.length !== 1 ||
    branches.branch_policies[0].name !== 'main' ||
    branches.branch_policies[0].type !== 'branch'
  ) {
    throw new Error('Environment must allow only the main branch.');
  }
  if (production) {
    const reviewers = environment.protection_rules?.find(
      (rule) => rule.type === 'required_reviewers',
    );
    if (
      !reviewers?.reviewers?.length ||
      !reviewers.prevent_self_review ||
      reviewers.reviewers.some((entry) => entry.type !== 'User' || !entry.reviewer?.id)
    ) {
      throw new Error('Production requires individual user reviewers and no self-review.');
    }
  }
}

export function assertApproval(environment, history, actorIds) {
  const reviewers = environment.protection_rules.find((rule) => rule.type === 'required_reviewers');
  const allowed = reviewers.reviewers.map((entry) => entry.reviewer.id);
  if (
    !environment.id ||
    !actorIds.every(Number.isInteger) ||
    !history.some(
      (review) =>
        review.state === 'approved' &&
        allowed.includes(review.user?.id) &&
        !actorIds.includes(review.user.id) &&
        review.environments?.some((entry) => entry.id === environment.id),
    )
  ) {
    throw new Error(
      'A configured reviewer must explicitly approve this production run; bypass is insufficient.',
    );
  }
}

export async function successfulRun(target, sha) {
  const query = new URLSearchParams({
    branch: 'main',
    event: target === 'cloud-dev' ? 'push' : 'workflow_dispatch',
    status: 'success',
    per_page: '100',
  });
  // Cloud DEV also supports deliberate manual recovery; include both events.
  if (target === 'cloud-dev') query.delete('event');
  if (sha) query.set('head_sha', sha);
  for (let page = 1; page <= 10; page++) {
    const { workflow_runs: runs } = await github(
      `actions/workflows/${target}.yml/runs?${query}&page=${page}`,
    );
    const match = runs.find(
      (run) =>
        String(run.id) !== process.env.GITHUB_RUN_ID &&
        ['push', 'workflow_dispatch'].includes(run.event) &&
        run.conclusion === 'success' &&
        run.head_repository?.full_name === process.env.GITHUB_REPOSITORY &&
        (!sha || run.head_sha === sha),
    );
    if (match) return match.head_sha;
    if (runs.length < 100) return null;
  }
  throw new Error('Release history exceeds audit limit; review the baseline explicitly.');
}

export async function assertMain() {
  if (
    !TRUSTED_REPOSITORIES.has(process.env.GITHUB_REPOSITORY ?? '') ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    !/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA ?? '')
  )
    throw new Error('Release requires the trusted main ref.');
  const { sha } = await github('commits/main');
  if (sha !== process.env.GITHUB_SHA) throw new Error('Candidate is stale: main has advanced.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== sha) throw new Error('Checkout does not match the release SHA.');
}

export async function preflight(target, requireApproval = false) {
  targetFor(target);
  await assertMain();
  const environment = await github(`environments/${target}`);
  const branches = await github(`environments/${target}/deployment-branch-policies`);
  assertProtection(environment, branches, target === 'production');
  if (target === 'production') {
    // Review history is run-scoped. A fresh dispatch prevents an old approval
    // from authorizing a bypass on a later attempt.
    if (process.env.GITHUB_RUN_ATTEMPT !== '1')
      throw new Error('Production recovery requires a fresh dispatch and approval.');
    if (requireApproval) {
      const run = await github(`actions/runs/${process.env.GITHUB_RUN_ID}`);
      const history = await github(`actions/runs/${process.env.GITHUB_RUN_ID}/approvals`);
      assertApproval(environment, history, [run.actor?.id, run.triggering_actor?.id]);
    }
    if (
      process.env.RELEASE_CONFIRMATION !== `production:${process.env.GITHUB_SHA}` ||
      process.env.RELEASE_CANDIDATE !== process.env.GITHUB_SHA
    )
      throw new Error('Explicit production SHA confirmation required.');
    if (!(await successfulRun('cloud-dev', process.env.GITHUB_SHA)))
      throw new Error('This exact SHA has not passed Cloud DEV delivery and smoke.');
  }
}

export function summary(text) {
  console.warn(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  preflight(process.env.RELEASE_TARGET).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
