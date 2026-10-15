-- The member's rating of a visit: 1-5 stars and an optional comment.
--
-- 🔴 WHY: owner, 2026-10-15, after Al Ameed's app — «ابني لقطة التقييم واضافة
-- النقاط». The next time the app opens after a purchase, it says how many
-- points were added and asks for a rating of that branch
-- (packages/shared/src/loyalty/visitRating.ts). The order screen's «قيّم» uses
-- the same table. Before this, the app posted ratings to a route the server
-- never had, and the mock paid 50 points for one; rating now pays NOTHING.
--
--   visit_ref   the purchase line's point_history.source_ref
--               (20261015_point_history_detail.sql): 'order:<id>' or
--               'pos:<ref>'. ONE rating per visit per member (the unique key);
--               the writer checks the visit is this member's purchase.
--   branch_id   copied from that purchase line, so a branch's ratings are read
--               without joining the ledger.
--   comment     trimmed, empty stored as NULL, at most 500 characters
--               (config.VISIT_RATING_COMMENT_MAX).
--
-- FK RESTRICT, as every member-owned table (20260925). Closed to Supabase's
-- public API roles like every loyalty table (guarded REVOKE). Re-runnable.

create table if not exists visit_ratings (
  id          bigserial primary key,
  member_id   text not null references members(id) on delete restrict,
  visit_ref   text not null check (visit_ref ~ '^(order|pos):.+$' and char_length(visit_ref) <= 128),
  branch_id   text not null check (char_length(branch_id) between 1 and 64),
  stars       smallint not null check (stars between 1 and 5),
  comment     text check (comment is null or (char_length(comment) between 1 and 500)),
  created_at  timestamptz not null default now(),
  constraint visit_ratings_once unique (member_id, visit_ref)
);

create index if not exists visit_ratings_branch_idx on visit_ratings (branch_id, created_at desc);

-- The pending-visit read: a member's newest purchase lines.
create index if not exists point_history_member_kind_idx on point_history (member_id, kind, created_at desc);

alter table visit_ratings enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table visit_ratings from %I', r);
      execute format('revoke all on sequence visit_ratings_id_seq from %I', r);
    end if;
  end loop;
end
$$;
