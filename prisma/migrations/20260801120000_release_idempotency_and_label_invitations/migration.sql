-- AlterTable: idempotency key for POST /artist/releases
ALTER TABLE "releases" ADD COLUMN "idempotency_key" VARCHAR(100);
CREATE UNIQUE INDEX "releases_idempotency_key_key" ON "releases"("idempotency_key");

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "label_artist_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "accepted_user_id" TEXT,

    CONSTRAINT "label_artist_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "label_artist_invitations_token_hash_key" ON "label_artist_invitations"("token_hash");
CREATE INDEX "label_artist_invitations_email_idx" ON "label_artist_invitations"("email");
CREATE INDEX "label_artist_invitations_label_id_idx" ON "label_artist_invitations"("label_id");
CREATE UNIQUE INDEX "label_artist_invitations_label_id_email_status_key" ON "label_artist_invitations"("label_id", "email", "status");

-- AddForeignKey
ALTER TABLE "label_artist_invitations" ADD CONSTRAINT "label_artist_invitations_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "label_artist_invitations" ADD CONSTRAINT "label_artist_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Case-insensitive uniqueness for user emails. All write paths already
-- lowercase before insert/lookup (register, InsForge sync, label invites) -
-- this is the DB-level backstop so that guarantee can't silently drift.
-- If this fails, two existing rows differ only by case; resolve manually
-- before re-running (merge or rename one) rather than retrying blindly.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(LOWER("email"));
