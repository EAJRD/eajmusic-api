// Pushes a per-track streams/revenue snapshot into InsForge's
// track_stats_snapshot table (see EAJMUSIC-PAGE-COMPLATE-V1's
// migrations/20260801041428_create-track-stats-snapshot.sql), so the artist
// dashboard can still show recent stats if this API/DB is down. This is a
// read-availability cache, not a backup - the real streaming data always
// lives here, in this Postgres, via StreamingStat.
//
// Run every 30 days (crontab on the app server) - deliberately not more
// often: the DSPs this platform reports from only refresh their own numbers
// roughly every ~3 months, so a 30-day cache window doesn't lose meaningful
// freshness and keeps this an infrequent background job instead of a live
// dependency on every stats read.
//
// Usage: node scripts/syncStatsToInsforge.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createAdminClient } from '@insforge/sdk';

const prisma = new PrismaClient();

if (!process.env.INSFORGE_URL || !process.env.INSFORGE_API_KEY) {
  console.error('[syncStatsToInsforge] Missing INSFORGE_URL or INSFORGE_API_KEY - aborting.');
  process.exit(1);
}

const insforge = createAdminClient({
  baseUrl: process.env.INSFORGE_URL,
  apiKey: process.env.INSFORGE_API_KEY,
});

async function main() {
  const artists = await prisma.user.findMany({
    where: { role: 'ARTIST', insforgeUserId: { not: null } },
    select: { id: true, insforgeUserId: true, email: true },
  });

  let artistsSynced = 0;
  let trackRowsSynced = 0;
  let failures = 0;

  for (const artist of artists) {
    const tracks = await prisma.track.findMany({
      where: { release: { userId: artist.id } },
      select: {
        id: true,
        title: true,
        releaseId: true,
        streamingStats: { select: { streams: true, revenueNet: true } },
      },
    });

    const rows = tracks.map((t) => ({
      insforge_user_id: artist.insforgeUserId,
      track_id: t.id,
      release_id: t.releaseId,
      title: t.title,
      streams: t.streamingStats.reduce((sum, s) => sum + Number(s.streams), 0),
      revenue: t.streamingStats.reduce((sum, s) => sum + Number(s.revenueNet), 0),
      synced_at: new Date().toISOString(),
    }));

    // Replace this artist's whole snapshot each run - simpler and safer than
    // an upsert-by-track-id loop (e.g. a track that was deleted here since
    // the last sync would otherwise linger in InsForge forever).
    const { error: deleteError } = await insforge.database
      .from('track_stats_snapshot')
      .delete()
      .eq('insforge_user_id', artist.insforgeUserId);
    if (deleteError) {
      console.error(`[syncStatsToInsforge] Failed to clear snapshot for ${artist.email}:`, deleteError.message);
      failures++;
      continue;
    }

    if (rows.length === 0) {
      artistsSynced++;
      continue;
    }

    const { error: insertError } = await insforge.database.from('track_stats_snapshot').insert(rows);
    if (insertError) {
      console.error(`[syncStatsToInsforge] Failed to write snapshot for ${artist.email}:`, insertError.message);
      failures++;
      continue;
    }

    artistsSynced++;
    trackRowsSynced += rows.length;
  }

  console.log(`[syncStatsToInsforge] Done. Artists synced: ${artistsSynced}/${artists.length}, track rows: ${trackRowsSynced}, failures: ${failures}.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('[syncStatsToInsforge] Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
