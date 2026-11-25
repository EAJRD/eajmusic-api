import { createReleaseSchema } from '../validators/release.js';

// PATCH updates supplied tracks in place; omitting a track does not delete it.
export async function editTracks(tx, releaseId, edits) {
  if (!edits) return;
  const existing = await tx.track.findMany({ where: { releaseId } });
  for (const edit of edits) {
    const track = edit.id ? existing.find(t => t.id === edit.id)
      : existing.find(t => t.trackNumber === edit.trackNumber && t.discNumber === (edit.discNumber || 1));
    if (edit.id && !track) throw Object.assign(new Error('Track does not belong to this release'), { statusCode: 400 });
    const { id, contributors, ...data } = edit;
    const rights = contributors === undefined ? {} : {
      contributors: { ...(track ? { deleteMany: {} } : {}), create: contributors },
    };
    if (track) await tx.track.update({ where: { id: track.id }, data: { ...data, ...rights } });
    else await tx.track.create({ data: { ...data, ...rights, releaseId } });
  }
}

export function submissionIssues(release, subscription, now = new Date()) {
  const issues = [];
  const parsed = createReleaseSchema.safeParse({
    ...release,
    releaseDate: new Date(release.releaseDate).toISOString(),
    originalReleaseDate: release.originalReleaseDate ? new Date(release.originalReleaseDate).toISOString() : null,
    tracks: release.tracks.map(track => ({ ...track, contributors: (track.contributors || []).map(c => ({ ...c, royaltyPercentage: Number(c.royaltyPercentage) })) })),
  });
  if (!parsed.success) issues.push(...parsed.error.issues.map(issue => issue.message));
  if (!release.coverArtUrl && !release.coverArtKey) issues.push('Cover artwork is required');
  if (release.tracks.some(track => !track.audioKey && !track.audioUrl)) issues.push('Every track requires audio');
  if (release.tracks.some(track => !track.contributors?.length)) issues.push('Every track requires contributor rights');
  const minDays = (subscription?.plan || 'FREE') === 'FREE' ? 45 : 21;
  const minimum = new Date(now);minimum.setDate(minimum.getDate() + minDays);
  if (new Date(release.releaseDate) < minimum) issues.push(`Release needs ${minDays} days of lead time`);
  return issues;
}
