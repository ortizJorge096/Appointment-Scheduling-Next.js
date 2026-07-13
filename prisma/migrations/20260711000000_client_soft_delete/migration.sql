-- Soft-delete (archive) support for clients: hide from the active directory
-- while preserving the record and its appointment links. Reversible.
ALTER TABLE "clients" ADD COLUMN "deletedAt" TIMESTAMP(3);
