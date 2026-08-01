# Odoo 19 Performance Audit Runbook — Almond

**Route (Abu Laith):** slowness → tuanle `odoo-perf` + `/odoo` introspection, then
ignify `references/odoo-19-performance.md` for the fix. **Everything here is
READ-ONLY measurement.**

## Guardrails
- Run on **`dev-almond`** (or a prod *replica*) with a **read-only** DB user.
- **Production `ag-almond-coffee-house-master1`:** no access without a typed
  `APPROVE PROD`. Even then, only the read-only queries below, during a
  representative load window — never heavy scans on the live master.
- No writes, no VACUUM FULL, no config changes here — this run only *diagnoses*.

## Pipeline
```
1) introspect  → tuanle /odoo        (rank hot entrypoints: buttons/crons/routes)
2) measure     → this runbook        (infra → PG → app → data → hotspots)
3) diagnose    → tuanle odoo-perf     (N+1, missing index, prefetch findings)
4) author fix  → ignify perf ref
5) review/gate → tuanle /odoo-review, /odoo-gate
```

---

## Layer 1 — Infra / process
```bash
# live resource pressure during load
top -b -n1 | head -20
free -h ; iostat -x 1 3 2>/dev/null

# Odoo worker + limits (rule of thumb: workers = 2*cpu + 1; ≥1 cron worker)
grep -E 'workers|max_cron_threads|limit_memory|limit_time_cpu|limit_time_real|db_maxconn' /etc/odoo/odoo.conf
```
Red flags: `workers=0` (multi-user prod), `limit_time_real` too low (kills long
reports), `max_cron_threads=0`, memory limits causing worker recycling.

## Layer 2 — PostgreSQL (the usual root cause)
```sql
-- one-time (superuser): CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- top 20 heaviest statements by cumulative time
SELECT round(total_exec_time::numeric,0) AS total_ms, calls,
       round(mean_exec_time::numeric,2) AS mean_ms, rows, left(query,140) AS q
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

-- queries running right now > 2s
SELECT pid, now()-query_start AS runtime, state, left(query,140)
FROM pg_stat_activity
WHERE state <> 'idle' AND now()-query_start > interval '2 seconds'
ORDER BY runtime DESC;

-- cache hit ratio (want > 0.99; lower ⇒ raise shared_buffers / RAM)
SELECT round(sum(blks_hit)::numeric/nullif(sum(blks_hit)+sum(blks_read),0),4) AS cache_hit
FROM pg_stat_database;

-- largest relations
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS total, n_live_tup AS rows
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;

-- big tables hit by sequential scans ⇒ missing-index candidates
SELECT relname, seq_scan, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE n_live_tup > 50000 AND seq_scan > coalesce(idx_scan,0)
ORDER BY seq_scan DESC LIMIT 20;

-- dead-tuple bloat ⇒ needs autovacuum tuning / ANALYZE
SELECT relname, n_dead_tup, n_live_tup,
       round(100*n_dead_tup::numeric/nullif(n_live_tup,0),1) AS dead_pct
FROM pg_stat_user_tables WHERE n_dead_tup > 10000 ORDER BY n_dead_tup DESC LIMIT 20;

-- key PG settings
SHOW shared_buffers; SHOW work_mem; SHOW effective_cache_size; SHOW max_connections;
```

## Layer 3 — Odoo application (requests / N+1)
Werkzeug access log ends each line with `<query_count> <db_sec> <other_sec>`:
```bash
# requests with >200 queries (N+1) or >1s — adjust the log path
awk '{n=$(NF-2); db=$(NF-1); ot=$NF} n+0>200 || ot+0>1 {print}' /var/log/odoo/odoo.log | tail -40
# slowest routes overall
grep -oE '"(GET|POST) [^"]+' /var/log/odoo/odoo.log | sort | uniq -c | sort -rn | head -20
```
High `query_count` on one request = **N+1** (unbatched loop / non-prefetched
relation). High `db_sec` = a slow SQL (cross-ref Layer 2).

## Layer 4 — Data volume (read-only, via `odoo-bin shell`)
```python
# odoo-bin shell -d dev-almond   (read-only user)
cr = self.env.cr
cr.execute("SELECT relname,n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20"); cr.fetchall()

# stored computed fields = recompute cost on writes
self.env['ir.model.fields'].search_count([('store','=',True),('compute','!=',False)])

# cron inventory (over-frequent or long crons drag the whole node)
[(c.name, c.interval_number, c.interval_type, c.active) for c in self.env['ir.cron'].search([])]

# classic bloat sources
self.env['mail.message'].search_count([])      # chatter
self.env['ir.attachment'].search_count([])     # PDFs / JoFotara / assets
self.env['ir.logging'].search_count([])        # debug logging left on
```

## Layer 5 — Hotspots via tuanle
```
/odoo          # Layer-K: rank the live entrypoint surface (buttons/crons/routes)
               # + sample the real cross-app flow (Execution Surface Graph)
# then consult the odoo-perf skill for concrete N+1 / index / prefetch findings
```

---

## Findings template (fill per issue)
| # | Layer | Metric (measured) | Threshold | Finding | Fix (ignify ref) | Priority |
|---|---|---|---|---|---|---|
| 1 | PG | mean_ms=… on `account_move` scan | >50ms | seq scan, no index on `X` | add `index=True`/`models.Index` | H |
| 2 | App | 480 queries on POS load | >200 | N+1 on `order.lines` | prefetch / batch | H |

## Quick wins (verify each on dev first)
- Add DB index on frequently-searched non-stored fields (`index=True` / `models.Index`).
- `store=True` + correct `@api.depends` on heavy computes read in lists.
- Batch crons; replace `search()`/`create()` in loops with domain-`IN` / `create([...])`.
- Prune `mail.message` + orphan `ir.attachment`; turn off `ir.logging`.
- Tune Postgres (`shared_buffers` ~25% RAM, `work_mem`, autovacuum) + Odoo `workers`.
- Regular `ANALYZE`; investigate dead-tuple bloat tables.

## Almond-specific hotspots (from our prior work)
- **`account.move` / `account.move.line`** — Inter-Company invoice duplication we
  found inflates rows; cleaning duplicates also cuts this table (perf + books win).
- **`pos.order` / `pos.order.line`** — volume across 10 branches; index by branch/date.
- **`ir.attachment`** — JoFotara/receipt PDFs pile up; archive policy.
- **`stock.move.line`** — grows with the warehouse-requisition flow; watch indexes.
- **`mail.message`** — chatter on high-traffic models (orders) bloats fast.

> After fixes: re-run Layers 2–4, compare `pg_stat_statements` deltas, and pass
> the change through `/odoo-review` → `/odoo-gate` before any deploy.
