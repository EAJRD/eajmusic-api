-- Adds the HELD release status, alone in its own migration on purpose.
--
-- PostgreSQL will not let a newly added enum value be USED in the same
-- transaction that added it, and `prisma migrate deploy` runs each migration
-- file in one transaction. Keeping this by itself guarantees the value is
-- committed before anything in a later migration (or in application code)
-- can reference it.
ALTER TYPE "ReleaseStatus" ADD VALUE IF NOT EXISTS 'HELD';
