// Grupo 4.2: when someone credited a contributor by free-text name (no
// account existed yet - TrackContributor.artistProfileId is nullable for
// exactly this reason) and later that same person registers a real
// ArtistProfile under a matching name, this surfaces a one-click approval
// in the Super Dashboard instead of silently auto-linking (auto-linking a
// name match with no human check could hand someone else's catalog to the
// wrong account).
export async function detectContributorMatches(tx, userId, artistProfileName) {
  const trimmedName = (artistProfileName || '').trim();
  if (!trimmedName) return;

  const orphaned = await tx.trackContributor.findMany({
    where: { artistProfileId: null, name: { equals: trimmedName, mode: 'insensitive' } },
    select: { id: true, trackId: true },
  });
  if (orphaned.length === 0) return;

  const existing = await tx.contributorMatchRequest.findFirst({
    where: { contributorName: trimmedName, matchedUserId: userId, status: 'PENDING' },
  });
  if (existing) return;

  await tx.contributorMatchRequest.create({
    data: {
      contributorName: trimmedName,
      matchedUserId: userId,
      trackIds: [...new Set(orphaned.map((o) => o.trackId))],
    },
  });
}
