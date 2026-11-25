CREATE TABLE "stored_uploads" (
  "key" VARCHAR(500) PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "stored_uploads_user_id_idx" ON "stored_uploads"("user_id");
-- Preserve only unambiguous legacy ownership; conflicting claims need review.
INSERT INTO "stored_uploads" ("key", "user_id")
SELECT "key", MIN("user_id") FROM (
  SELECT t."audio_key" AS "key", r."user_id" FROM "tracks" t JOIN "releases" r ON r."id" = t."release_id"
  UNION ALL SELECT "cover_art_key", "user_id" FROM "releases"
  UNION ALL SELECT "id_document_key", "id" FROM "users"
  UNION ALL SELECT substring("avatar_url" from '/uploads/(images/[^/?#]+)'), "id" FROM "users"
  UNION ALL SELECT substring(t."audio_url" from '/uploads/(audio/[^/?#]+)'), r."user_id" FROM "tracks" t JOIN "releases" r ON r."id" = t."release_id" WHERE t."audio_key" IS NULL
  UNION ALL SELECT substring("cover_art_url" from '/uploads/(images/[^/?#]+)'), "user_id" FROM "releases" WHERE "cover_art_key" IS NULL
) assets
WHERE "key" IS NOT NULL AND "key" <> ''
GROUP BY "key" HAVING COUNT(DISTINCT "user_id") = 1;
