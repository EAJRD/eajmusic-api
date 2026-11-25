ALTER TABLE "payouts" ADD COLUMN "idempotency_key" VARCHAR(100);
CREATE UNIQUE INDEX "payouts_user_id_idempotency_key_key" ON "payouts"("user_id", "idempotency_key");
-- Existing duplicate non-null receipts must be reconciled before applying.
-- Do not silently delete historical financial records in a migration.
CREATE UNIQUE INDEX "payouts_method_transaction_id_key" ON "payouts"("method", "transaction_id");
