-- Immutability: audit entries must never be edited. A trigger rejects any UPDATE.
-- Row triggers only affect DML, so future schema migrations (ALTER TABLE) still work.
-- DELETE is intentionally NOT blocked: the app has no delete endpoint, but leaving
-- DELETE open keeps retention/pruning possible via a deliberate maintenance path.
-- Runs AFTER 20260625000000 so its backfill UPDATE completes before the trigger exists.

CREATE OR REPLACE FUNCTION reject_audit_log_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable: UPDATE is not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_update();

-- ── ROLLBACK (manual) ───────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
--   DROP FUNCTION IF EXISTS reject_audit_log_update();
