-- AlterTable
ALTER TABLE "users" ADD COLUMN "insforge_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_insforge_user_id_key" ON "users"("insforge_user_id");
