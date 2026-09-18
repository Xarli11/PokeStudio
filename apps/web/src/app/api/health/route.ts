// Deployment identity only. Database integrity is checked separately with public reads.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const sha = process.env.POKELAB_RELEASE_SHA ?? process.env.POKESTUDIO_RELEASE_SHA;
  const target = process.env.POKELAB_RELEASE_TARGET ?? process.env.POKESTUDIO_RELEASE_TARGET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Response.json(
    {
      sha: sha ?? null,
      target: target ?? null,
      projectRef: url ? new URL(url).hostname.split('.')[0] : null,
    },
    { status: sha && target ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
