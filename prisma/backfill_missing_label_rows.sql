-- One-time backfill for LABEL accounts provisioned before the fix in
-- POST /auth/sync-insforge-user (auth.js) that now creates a Label row for
-- every new LABEL signup. Every LABEL account created before that fix has
-- no Label row at all, which makes /artist/label/artists/claim and
-- /artist/label/artists/invite always 400 with "No se encontró un Sello
-- asociado a tu cuenta" for them.
--
-- Safe to re-run: only inserts for users that are role=LABEL and have no
-- existing Label row (checked via NOT EXISTS), so running this twice is a
-- no-op the second time.
-- gen_random_uuid() is a core Postgres 13+ function, no extension needed.
-- Ids are TEXT in this schema (Prisma generates UUIDs client-side, with no
-- DB-level DEFAULT on the column) - cast explicitly rather than relying on
-- an implicit uuid->text cast.
INSERT INTO "labels" (id, user_id, name, created_at)
SELECT gen_random_uuid()::text, u.id, u.name, now()
FROM "users" u
WHERE u.role = 'LABEL'
  AND NOT EXISTS (SELECT 1 FROM "labels" l WHERE l.user_id = u.id);

-- Verify: should return 0 rows after running the INSERT above.
-- SELECT id, email, name FROM "users" WHERE role = 'LABEL'
--   AND NOT EXISTS (SELECT 1 FROM "labels" l WHERE l.user_id = "users".id);
