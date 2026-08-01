-- Almond Odoo perf + gap COLLECTOR — READ ONLY. Safe to run on dev-almond
-- (read-only user). For prod: only with APPROVE PROD, during a normal window.
--   Run:  psql -d dev-almond -f collector.sql > almond_odoo_snapshot.txt
-- Then send almond_odoo_snapshot.txt back for analysis. No writes, no vacuum.

\echo '===== 0. VERSIONS ====='
SELECT version();
SELECT name, latest_version FROM ir_module_module WHERE name IN ('base','point_of_sale','account','stock','mrp');

\echo '===== 1. INSTALLED MODULES ====='
SELECT name, latest_version FROM ir_module_module WHERE state='installed' ORDER BY name;

\echo '===== 2. LARGEST TABLES ====='
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total, n_live_tup AS rows
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 25;

\echo '===== 3. TOP SLOW STATEMENTS (needs pg_stat_statements) ====='
SELECT round(total_exec_time::numeric,0) AS total_ms, calls,
       round(mean_exec_time::numeric,2) AS mean_ms, rows, left(query,160) AS q
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 25;

\echo '===== 4. SEQ-SCAN / MISSING-INDEX CANDIDATES ====='
SELECT relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE n_live_tup > 20000 AND seq_scan > coalesce(idx_scan,0)
ORDER BY seq_scan DESC LIMIT 25;

\echo '===== 5. DEAD-TUPLE BLOAT ====='
SELECT relname, n_dead_tup, n_live_tup,
       round(100*n_dead_tup::numeric/nullif(n_live_tup,0),1) AS dead_pct, last_autovacuum
FROM pg_stat_user_tables WHERE n_dead_tup > 5000 ORDER BY n_dead_tup DESC LIMIT 25;

\echo '===== 6. CACHE HIT + PG SETTINGS ====='
SELECT round(sum(blks_hit)::numeric/nullif(sum(blks_hit)+sum(blks_read),0),4) AS cache_hit FROM pg_stat_database;
SELECT name, setting, unit FROM pg_settings
WHERE name IN ('shared_buffers','work_mem','effective_cache_size','max_connections','maintenance_work_mem');

\echo '===== 7. KEY ROW COUNTS (perf + gap signals) ====='
SELECT 'account_move' AS t, count(*) FROM account_move
UNION ALL SELECT 'account_move_line', count(*) FROM account_move_line
UNION ALL SELECT 'pos_order', count(*) FROM pos_order
UNION ALL SELECT 'pos_order_line', count(*) FROM pos_order_line
UNION ALL SELECT 'stock_move_line', count(*) FROM stock_move_line
UNION ALL SELECT 'mail_message', count(*) FROM mail_message
UNION ALL SELECT 'ir_attachment', count(*) FROM ir_attachment
UNION ALL SELECT 'ir_logging', count(*) FROM ir_logging;

\echo '===== 8. GAP SIGNALS ====='
-- zero-cost products (gap #3/#4)
SELECT count(*) AS products_zero_cost FROM product_template WHERE coalesce(standard_price,0)=0;
-- duplicate-looking invoices per partner+amount+date (gap #1)
SELECT partner_id, amount_total, invoice_date, count(*) AS dups
FROM account_move WHERE move_type IN ('out_invoice','in_invoice') AND state!='cancel'
GROUP BY partner_id, amount_total, invoice_date HAVING count(*)>1
ORDER BY dups DESC LIMIT 20;
-- stored computed fields (recompute cost)
SELECT count(*) AS stored_computed_fields FROM ir_model_fields WHERE store AND compute IS NOT NULL;
-- crons (over-frequent/long)
SELECT name, interval_number, interval_type, active FROM ir_cron ORDER BY active DESC, interval_number;
-- UoM precision (gap #2): rounding of Product UoM category
SELECT u.name, u.rounding FROM uom_uom u ORDER BY u.rounding DESC LIMIT 15;

\echo '===== END ====='
