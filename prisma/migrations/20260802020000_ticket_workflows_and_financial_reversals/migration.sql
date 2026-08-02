-- Ticket workflows + financial reversals.
--
-- Hand-written rather than generated: `prisma migrate dev` hard-checks
-- isTTY and refuses to run over SSH on this project's deploy path, so the
-- convention here is to write the SQL and apply it with `migrate deploy`.

-- ---------------------------------------------------------------------
-- 1. Releases remember what they were before a hold.
-- ---------------------------------------------------------------------
-- The 'HELD' enum value itself is added by the preceding migration
-- (20260802015900_release_held_status), separately and deliberately - see
-- the note there about enum values and transactions.
ALTER TABLE "releases"
  ADD COLUMN IF NOT EXISTS "status_before_hold" "ReleaseStatus";

-- ---------------------------------------------------------------------
-- 2. Support tickets carry a formal workflow position.
-- ---------------------------------------------------------------------
-- Defaults are chosen so every existing row is already valid: GENERAL/OPEN
-- is exactly what a pre-migration ticket was.
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "workflow_type"  VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "workflow_state" VARCHAR(40) NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "related_release_id" TEXT,
  ADD COLUMN IF NOT EXISTS "related_payout_id"  TEXT;

-- Backfill: tickets already resolved/closed shouldn't reappear as open cases
-- in the new workflow view.
UPDATE "support_tickets"
   SET "workflow_state" = 'RESOLVED'
 WHERE "workflow_type" = 'GENERAL'
   AND "status" IN ('RESOLVED', 'CLOSED')
   AND "workflow_state" = 'OPEN';

CREATE INDEX IF NOT EXISTS "support_tickets_workflow_type_workflow_state_idx"
  ON "support_tickets" ("workflow_type", "workflow_state");

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_related_release_id_fkey"
  FOREIGN KEY ("related_release_id") REFERENCES "releases" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_related_payout_id_fkey"
  FOREIGN KEY ("related_payout_id") REFERENCES "payouts" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 3. Append-only case file: every state change on a ticket.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ticket_workflow_events" (
  "id"         TEXT NOT NULL,
  "ticket_id"  TEXT NOT NULL,
  "actor_id"   TEXT NOT NULL,
  "from_state" VARCHAR(40) NOT NULL,
  "to_state"   VARCHAR(40) NOT NULL,
  "effect"     VARCHAR(40),
  "note"       TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ticket_workflow_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ticket_workflow_events_ticket_id_created_at_idx"
  ON "ticket_workflow_events" ("ticket_id", "created_at");

ALTER TABLE "ticket_workflow_events"
  ADD CONSTRAINT "ticket_workflow_events_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "support_tickets" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_workflow_events"
  ADD CONSTRAINT "ticket_workflow_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 4. Financial reversals, under a two-person rule.
-- ---------------------------------------------------------------------
-- requested_by_id != approved_by_id is enforced both here (so the database
-- itself refuses a self-approved reversal, whatever the application does)
-- and in POST /admin/reversals/:id/approve for a readable error.
CREATE TABLE IF NOT EXISTS "financial_reversals" (
  "id"              TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "wallet_id"       TEXT NOT NULL,
  "amount"          DECIMAL(12,2) NOT NULL,
  "currency"        CHAR(3) NOT NULL DEFAULT 'USD',
  "reason"          TEXT NOT NULL,
  "status"          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "ticket_id"       TEXT,
  "payout_id"       TEXT,
  "requested_by_id" TEXT NOT NULL,
  "requested_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by_id"  TEXT,
  "approved_at"     TIMESTAMP(3),
  "decision_note"   TEXT,
  "balance_before"  DECIMAL(12,2),
  "balance_after"   DECIMAL(12,2),

  CONSTRAINT "financial_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_reversals_two_person_rule"
    CHECK ("approved_by_id" IS NULL OR "approved_by_id" <> "requested_by_id")
);

CREATE INDEX IF NOT EXISTS "financial_reversals_status_requested_at_idx"
  ON "financial_reversals" ("status", "requested_at");

ALTER TABLE "financial_reversals"
  ADD CONSTRAINT "financial_reversals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_reversals"
  ADD CONSTRAINT "financial_reversals_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_reversals"
  ADD CONSTRAINT "financial_reversals_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_reversals"
  ADD CONSTRAINT "financial_reversals_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_reversals"
  ADD CONSTRAINT "financial_reversals_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "support_tickets" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_reversals"
  ADD CONSTRAINT "financial_reversals_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "payouts" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
