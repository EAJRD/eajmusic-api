const SYSTEM_LABEL_NAME = 'EAJMUSIC';

/**
 * Resolves the platform's default "EAJMUSIC" Label id, creating it on first
 * use. Every new ARTIST account is assigned this label unless/until they
 * move to a real one (see PATCH /artist/label, blocked for FREE-plan
 * artists).
 *
 * `Label.userId` is a required FK, so the system label needs an owner - it's
 * attached to whichever SUPER_ADMIN account exists. If none has been created
 * yet (a fresh deploy, before the first admin login is set up), this returns
 * null rather than failing registration; it resolves itself automatically
 * the next time this runs after a SUPER_ADMIN exists.
 *
 * Pass the active transaction client (`tx`) when called from inside a
 * prisma.$transaction(), otherwise the regular `prisma` client.
 */
export async function getOrCreateDefaultLabelId(db) {
  const existing = await db.label.findFirst({ where: { name: SYSTEM_LABEL_NAME } });
  if (existing) return existing.id;

  const owner = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!owner) return null;

  const label = await db.label.create({
    data: { userId: owner.id, name: SYSTEM_LABEL_NAME },
  });
  return label.id;
}
