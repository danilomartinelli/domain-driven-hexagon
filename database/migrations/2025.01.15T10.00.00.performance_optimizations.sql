-- Performance Optimizations Migration
-- Generated on: 2025-01-15T10:00:00
-- Description: Comprehensive database performance optimizations including indexes, constraints, and statistics

-- Enable query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create performance indexes for users table
-- Index for email lookups (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active
ON users (email)
WHERE deleted_at IS NULL;

-- Index for user creation date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at_desc
ON users (created_at DESC)
WHERE deleted_at IS NULL;

-- Composite index for filtering and pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_country_created_at
ON users (country, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for user search by name (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_gin
ON users USING gin (to_tsvector('english', name))
WHERE deleted_at IS NULL;

-- Create performance indexes for wallets table
-- Index for wallet by user_id (most critical foreign key lookup)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_id_unique
ON wallets (user_id);

-- Index for currency-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_currency
ON wallets (currency);

-- Composite index for balance operations and reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_currency_balance
ON wallets (currency, balance DESC);

-- Index for wallet transaction history (assuming we have transactions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_updated_at
ON wallets (updated_at DESC);

-- Add missing foreign key constraints for referential integrity
-- (These should exist but adding for completeness)
ALTER TABLE wallets
ADD CONSTRAINT IF NOT EXISTS fk_wallets_user_id
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create indexes for auth-related tables (if they exist)
-- User roles index for permission checking
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    -- Index for user role lookups
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_id
    ON user_roles (user_id);

    -- Index for role-based queries
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_role
    ON user_roles (role);

    -- Composite index for user permission checks
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_user_role
    ON user_roles (user_id, role);

    -- Add foreign key constraint
    ALTER TABLE user_roles
    ADD CONSTRAINT IF NOT EXISTS fk_user_roles_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create migration tracking table optimization
-- Index for migration tracking queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_migration_name
ON migration (name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_migration_executed_at
ON migration (executed_at DESC);

-- Optimize PostgreSQL statistics collection for better query planning
-- Increase statistics target for frequently queried columns
ALTER TABLE users ALTER COLUMN email SET STATISTICS 1000;
ALTER TABLE users ALTER COLUMN country SET STATISTICS 500;
ALTER TABLE users ALTER COLUMN created_at SET STATISTICS 500;

ALTER TABLE wallets ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE wallets ALTER COLUMN currency SET STATISTICS 500;
ALTER TABLE wallets ALTER COLUMN balance SET STATISTICS 500;

-- Create materialized view for user statistics (if needed for reporting)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_statistics AS
SELECT
  country,
  COUNT(*) as user_count,
  COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_users,
  MIN(created_at) as first_user_date,
  MAX(created_at) as latest_user_date
FROM users
WHERE deleted_at IS NULL
GROUP BY country;

-- Index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_statistics_country
ON user_statistics (country);

-- Create function to refresh user statistics (call this periodically)
CREATE OR REPLACE FUNCTION refresh_user_statistics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics;
END;
$$;

-- Create wallet balance summary view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS wallet_summary AS
SELECT
  currency,
  COUNT(*) as wallet_count,
  SUM(balance) as total_balance,
  AVG(balance) as average_balance,
  MIN(balance) as min_balance,
  MAX(balance) as max_balance,
  COUNT(CASE WHEN balance > 0 THEN 1 END) as funded_wallets
FROM wallets
GROUP BY currency;

-- Index on wallet summary
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_summary_currency
ON wallet_summary (currency);

-- Create function to refresh wallet summary
CREATE OR REPLACE FUNCTION refresh_wallet_summary()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY wallet_summary;
END;
$$;

-- Optimize table storage and maintenance
-- Set autovacuum settings for high-activity tables
ALTER TABLE users SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE wallets SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Create function for database maintenance (to be called via cron)
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh materialized views
  PERFORM refresh_user_statistics();
  PERFORM refresh_wallet_summary();

  -- Update table statistics
  ANALYZE users;
  ANALYZE wallets;

  -- Log maintenance completion
  RAISE NOTICE 'Database maintenance completed at %', NOW();
END;
$$;

-- Create check constraints for data integrity
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS chk_users_email_format
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS chk_users_name_length
CHECK (length(trim(name)) >= 1 AND length(name) <= 100);

ALTER TABLE wallets
ADD CONSTRAINT IF NOT EXISTS chk_wallets_balance_non_negative
CHECK (balance >= 0);

ALTER TABLE wallets
ADD CONSTRAINT IF NOT EXISTS chk_wallets_currency_format
CHECK (currency IN ('USD', 'EUR', 'GBP', 'BRL', 'JPY', 'CNY'));

-- Create audit trigger for wallet balance changes (if audit is needed)
CREATE OR REPLACE FUNCTION audit_wallet_balance_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.balance <> NEW.balance THEN
    -- Log balance changes (you could insert into an audit table here)
    RAISE NOTICE 'Wallet % balance changed from % to % at %',
      NEW.id, OLD.balance, NEW.balance, NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for wallet balance auditing
DROP TRIGGER IF EXISTS trigger_audit_wallet_balance ON wallets;
CREATE TRIGGER trigger_audit_wallet_balance
  AFTER UPDATE ON wallets
  FOR EACH ROW
  WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
  EXECUTE FUNCTION audit_wallet_balance_change();

-- Performance monitoring views
-- Create view for slow query monitoring
CREATE OR REPLACE VIEW slow_queries AS
SELECT
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries taking more than 100ms on average
ORDER BY mean_time DESC;

-- Create view for table usage statistics
CREATE OR REPLACE VIEW table_stats AS
SELECT
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_tup_ins + n_tup_upd + n_tup_del as total_operations,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE WHEN seq_scan + idx_scan > 0
    THEN 100.0 * idx_scan / (seq_scan + idx_scan)
    ELSE 0
  END as index_usage_percent
FROM pg_stat_user_tables
ORDER BY total_operations DESC;

-- Create view for index usage statistics
CREATE OR REPLACE VIEW index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Grant necessary permissions for monitoring views
GRANT SELECT ON slow_queries TO PUBLIC;
GRANT SELECT ON table_stats TO PUBLIC;
GRANT SELECT ON index_usage TO PUBLIC;
GRANT SELECT ON user_statistics TO PUBLIC;
GRANT SELECT ON wallet_summary TO PUBLIC;

-- Final optimization: Update table statistics
ANALYZE users;
ANALYZE wallets;
ANALYZE migration;