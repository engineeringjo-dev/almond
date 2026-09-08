-- Security hardening from the Supabase advisor scan.
--
-- CRITICAL: roastery_stock_adjust(text, numeric) is a real (non-trigger)
-- SECURITY DEFINER function that mutates roastery stock, and it is EXECUTable
-- by `anon`. The anon key ships inside the public app bundle, so anyone holding
-- it could POST /rest/v1/rpc/roastery_stock_adjust and move stock — bypassing
-- RLS, because SECURITY DEFINER runs as the owner.
revoke execute on function public.roastery_stock_adjust(text, numeric) from anon;

-- Trigger functions should never be reachable over the REST API. Postgres would
-- reject a direct call anyway, but leaving them granted is needless surface.
revoke execute on function public.recalc_open_order_lines()  from anon, authenticated;
revoke execute on function public.enforce_dispatch_ceiling() from anon, authenticated;
revoke execute on function public.enqueue_internal_transfer() from anon, authenticated;
revoke execute on function public.handle_new_user()          from anon, authenticated;
revoke execute on function public.set_created_by()           from anon, authenticated;
revoke execute on function public.set_updated_at()           from anon, authenticated;

-- Pin search_path on SECURITY DEFINER functions that lack it, so a caller
-- cannot shadow a referenced object with one from their own schema.
alter function public.set_updated_at()                set search_path = public;
alter function public.custom_access_token_hook()      set search_path = public;
alter function public.assign_warehouse_dispatch_no()  set search_path = public;
alter function public.assign_warehouse_order_no()     set search_path = public;
alter function public.assign_roastery_order_no()      set search_path = public;
