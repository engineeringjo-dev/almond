# خطة التصحيح النهائية — قرار اللجنة

**المشروع:** Almond · **التاريخ:** 2026-08-08 · **الحالة:** جاهزة للتنفيذ بعد PRE-FLIGHT
**الجمهور:** المالك (غير متخصص) + المهندس المنفّذ
**الملفات المعنية:**
`/home/user/almond/supabase/migrations/20260807_recalc_open_order_lines.sql` (مطبَّق — هو مصدر العطل)
`/home/user/almond/supabase/migrations/20260808_lock_down_rpc.sql` (غير مطبَّق — **لا يُطبَّق كما هو**)
الملف الجديد المقترح: `/home/user/almond/supabase/migrations/20260809_fix_recalc_open_order_lines.sql`

---

## الحكم والترتيب

### أ. الخطوات بالترتيب الإلزامي

| # | الخطوة | الكتلة | التصنيف | متى |
|---|--------|--------|---------|-----|
| **0** | **إيقاف النزيف فورا: تعطيل التريغر المعطوب** | BLOCK 0 | **SAFE** | الآن، قبل أي شيء آخر |
| **1** | تشغيل سكربت الـ PRE-FLIGHT كاملا وقراءة كل صف | §2 | قراءة فقط | فورا بعد 0 |
| **2** | التقاط الأساس (Baseline) وتصديره CSV خارج القاعدة | BLOCK 1 | **SAFE** | قبل أي تغيير |
| **3** | فتح استعادة PITR بتاريخ `2026-08-06 23:59:59 UTC` على **فرع/نسخة منفصلة** واستخراج نص السياسات القديمة | §3 | قراءة فقط | اليوم — نافذة الاحتفاظ تنتهي |
| **4** | إنشاء الفهرسين إن كانا مفقودين | BLOCK 2 | **NEEDS-VERIFICATION-FIRST** (I1) | قبل تفعيل الدالة الجديدة |
| **5** | نشر الدالة المصحَّحة + إعادة إنشاء التريغر | BLOCK 3 | **NEEDS-VERIFICATION-FIRST** (C1, V1) | بعد 4 |
| **6** | اختبارات دخان + انتظار 60 دقيقة مراقبة | §6 | — | إلزامي |
| **7** | تضييق صلاحيات الأعمدة على `warehouse_order_lines` | BLOCK 4 | **NEEDS-VERIFICATION-FIRST** (G1, G2, Edge Logs) | بعد 6 |
| **8** | `notify pgrst` | BLOCK 4b | **SAFE** | بعد 7 مباشرة، إرسال منفصل |
| **9** | سحب `EXECUTE` من `PUBLIC` على الدوال | BLOCK 5 | **NEEDS-VERIFICATION-FIRST** (F1, F2, Edge Logs) | بعد 8، صباحا لا مساء |
| **10** | تثبيت `search_path` على الدوال (باستثناء خطاف المصادقة) | BLOCK 6 | **NEEDS-VERIFICATION-FIRST** (F2, S1, أجسام الدوال) | بعد 9 |
| **11** | `notify pgrst` مرة ثانية | BLOCK 4b | **SAFE** | بعد 10 |
| **12** | مراقبة 24 ساعة | §7 | — | إلزامي |

**بين كل خطوتين: توقف 5 دقائق على الأقل ومراجعة لوحة الأخطاء. لا تُنفَّذ الخطوات متتابعة بلا فاصل.**
**النشر خارج ساعات طلبات الفروع وخارج نافذة الصرف (dispatch)، وليس يوم خميس.**

### ب. ما **يُمنع** تطبيقه الآن — بلا استثناء

| الممنوع | السبب |
|---|---|
| **أي `ALTER POLICY` أو `DROP/CREATE POLICY` على `warehouse_order_lines_update`** | نص الشرط الأصلي قبل 2026-08-07 **غير موجود** لا في المستودع ولا في القاعدة (`ALTER POLICY` يكتب فوق `pg_policy.polqual` بلا تاريخ). أي إعادة كتابة الآن = تغيير بلا تراجع |
| **إسقاط السياسة اليتيمة `wol_branch_edit_open` إن ظهرت** | قد تكون **الشيء الوحيد** الذي يسمح للفروع بالتعديل بعد ما فعله التزام `affa6cf9`. إسقاطها قد يقفل كل الفروع فورا. القرار يحتاج قراءة تعبيري السياستين جنبا إلى جنب |
| **سياسة `RESTRICTIVE` الحاجزة (`..._no_edit_after_ready`)** | تضييق حقيقي؛ يحتاج إثباتا من Edge Logs أن أحدا لا يعدّل طلبيات `received` بشكل مشروع. مرحلة ثانية |
| **`custom_access_token_hook`** (صلاحيات أو `search_path`) | خطأ واحد هنا يمنع **كل** المستخدمين من تسجيل الدخول، بمن فيهم أنت. هجرة مستقلة تماما، في نافذة منفصلة، بعد اختبار على فرع |
| **`20260808_lock_down_rpc.sql` كما هو** | السطر 22 يستعمل التوقيع `custom_access_token_hook()` بلا وسائط، والتوقيع الحقيقي المرجَّح `(jsonb)`. الخطأ `42883` يُلغي **الملف بأكمله** فلا يُطبَّق أي تشديد، بينما يبدو الفشل «بسيطا» |
| **`revoke create on schema public from public`** | أثر جانبي واسع على الامتدادات وأدوات Supabase. مرحلة ثانية |
| **حارس الأعمدة `wol_guard_system_columns`** | صار زائدا بعد BLOCK 4؛ يُضاف فقط إن أثبت التحقق أن العمليات تحتاج تعديل `suggested` بينما الفروع لا |
| **أي قاعدة على `min_qty`** | فرضية «لا يُطلب إلا تحت الحد الأدنى» غير مثبتة. تُرصد فقط، ولا تُطبَّق |
| **توسيع نطاق التريغر** إلى `INSERT` أو إلى تغيير `count_date` | تغيير دلالي منفصل، يُراجَع بذاته |
| **إصلاح البيانات المتضررة (الأسطر المصفَّرة)** | القيم السابقة لـ`suggested` **غير قابلة للاسترجاع من `audit_log`** لأن النسخة الحية سجّلت `count_qty` فقط. يلزم PITR أو نسخة منطقية سابقة لـ2026-08-07. خطة منفصلة |

### ج. حسم الخلافات بين المختصين

| الخلاف | القرار | المبرر |
|---|---|---|
| **قيمة `search_path`**: `public, extensions, pg_temp` (المختص 1 و3) مقابل `pg_catalog, public, extensions, pg_temp` (المختص 2) | **أعتمد نسخة المختص 2** وأفرضها موحّدة على كل الدوال بما فيها الدالة الجديدة | ذكر `pg_catalog` صراحة في الأول يمنع تظليل دوال النظام؛ حذفه يترك ثغرة لا مبرر لها. الكلفة صفر |
| **ترتيب النشر**: المختص 2 (الصلاحيات أولا: نضيّق قبل أن نوسّع) مقابل المختص 3 (تصحيح التريغر أولا: النزيف مستمر) | **أعتمد ترتيب المختص 3** | خلل التريغر يُتلف بيانات **الآن، يوميا**، بينما اتساع صلاحيات UPDATE خلل قائم منذ ما قبل الحادثة ولا دليل على استغلاله. وتصحيح التريغر لا يمسّ أي ACL ولا يقفل أي جدول، فهو الأقل خطرا على الإتاحة والأعلى عائدا. مبدأ المختص 2 «نضيّق قبل أن نوسّع» محفوظ **داخل** مرحلة الصلاحيات |
| **سياسة `warehouse_order_lines_update`**: المختص 2 يقترح شرطا فوقيا محافظا عند تعذّر الاسترجاع؛ المختص 3 يوقف كل شيء | **أعتمد المختص 3: لا تُلمس السياسة بلا PITR** | الشرط الفوقي المقترح يضيف `is_hq_ops`, `is_logistics`, `is_roastery_ops` بلا دليل على أنها كانت موجودة أصلا — أي **توسيع وصول قائم على تخمين، بلا أساس للتراجع**. الحماية الحقيقية تأتي من BLOCK 4 (صلاحيات الأعمدة) وهي لا تحتاج أي تخمين وتُلغى بأمر واحد |
| **`enforce_dispatch_ceiling`**: خطة المختص 3 تفترض إعادة كتابتها في المرحلة 3 | **لا تُعاد كتابتها.** لم يُنتج أي مختص نصا بديلا لها؛ الشيء الوحيد الذي يمسّها هو تثبيت `search_path` في BLOCK 6 | لا نُدخل في الإنتاج كودا غير مكتوب |
| **توقيع `custom_access_token_hook`**: المختص 2 يقول `(jsonb)`، المختص 3 يفحصه بـ`()` | **لا يُخمَّن أي توقيع.** الـPRE-FLIGHT يقرأ كل التواقيع من `pg_proc` بالاسم لا بالتخمين | تخمين التوقيع هو نفسه سبب فشل ملف 0808 |
| **هوية الفاعل في التدقيق (D10)**: المختص 1 يستعمل `auth.uid()`؛ المختص 3 يقول إننا لا نعرف الآلية المستعملة في المشروع | **الحل الهجين:** `auth.uid()` أولا، ثم `request.jwt.claims->>'sub'` احتياطا، وكلاهما داخل كتلة استثناء | يزيل الاعتماد على مخرَج حي، ويستحيل أن يُفشل تصحيح الجرد بسبب دالة مساعدة غائبة |
| **`max_qty IS NULL`**: تخطٍّ صامت مسجَّل (المختص 1) أم `RAISE` (تلميح المختص 3) | **تخطٍّ + تسجيل، بلا `raise`** | `RAISE` كان سيُفشل عملية تصحيح الجرد نفسها — وهي عملية مشروعة لا علاقة لها بالخلل. الشرط STOP عند المختص 3 مكتوب أصلا «RAISE **أو** skip»، فلا تعارض فعلي |

### د. ما **لا يمكن** حسمه بلا قراءة مخرَج حي (صريح)

1. هل `'ready'` هي الحالة الوحيدة القابلة للتعديل؟ → فحص **V1**. إن ظهرت حالة تمهيدية أخرى، تُضاف إلى `c_open_statuses` في BLOCK 3 **قبل** لصقه.
2. هل كل الأعمدة التي تشير إليها الدالة الجديدة موجودة (`emergency`, `direct_receive`, `disabled`, `min_qty`, `updated_at`, `audit_log.device`, `public.users`)? → فحص **C1**. عمود مفقود = الدالة تُنشأ بنجاح ثم **تفشل عند أول تعديل جرد** (أجسام plpgsql تُفحص نحويا فقط).
3. نص شرط `warehouse_order_lines_update` قبل 2026-08-07 → **PITR فقط**. بدونه لا تُلمس السياسة إطلاقا.
4. هل السياسة اليتيمة `wol_branch_edit_open` حيّة؟ وهل هي المصدر الوحيد لوصول الفروع؟ → فحص **P1/P2** + قراءة بشرية.
5. هل `warehouse_order_lines_update` سياسة PERMISSIVE أم RESTRICTIVE؟ → فحص **P1**. إن كانت RESTRICTIVE فكل فرضية هجرة 0807 خاطئة و**يتوقف كل شيء**.
6. التوقيع الحقيقي لكل دالة، ومالكها، و`proacl`، و`proconfig` → فحص **F2**. أي دالة مفقودة تُحذف من BLOCK 5 و6 قبل التنفيذ.
7. هل `custom_access_token_hook` مسجَّل فعلا كخطاف GoTrue؟ → **Dashboard → Authentication → Hooks** فقط. لا يُقرأ من SQL.
8. هل يوجد عميل حيّ ينادي `roastery_stock_adjust` بمفتاح `anon`/`authenticated`؟ → **Edge Logs** فقط.
9. هل يوجد مسار مشروع يكتب على `suggested`/`source` عبر REST؟ → **Edge Logs** (أجسام `PATCH`). يحدد ما إذا كان BLOCK 4 آمنا.
10. أسماء معاملات وجسم `roastery_stock_adjust` → `pg_get_functiondef`. بدونها لا يمكن كتابة نسخة محصَّنة (`CREATE OR REPLACE` يرفض تغيير أسماء المعاملات).
11. هل يوجد رابط سائق/موقع على `warehouse_orders`؟ → لا يوجد عمود `driver_id` في المخطط المُتحقَّق منه. **لا تُكتب أي فقرة سائقين.**
12. `warehouse_pars.max_qty IS NULL` — كم صفا وفي كم فرعا؟ → يحدد حجم الضرر الواقع وخطة الإصلاح اليدوي.

---

## 1. BLOCK 0 — إيقاف النزيف فورا · **SAFE**

يُنفَّذ **الآن**، قبل الـPRE-FLIGHT. يعيد السلوك إلى ما كان عليه يوم 2026-08-06 (لم يكن هناك تريغر أصلا)، فلا يكسر أي شيء كان يعمل.

```sql
-- BLOCK 0 · SAFE · stop the ongoing damage in one second.
-- Reverts behaviour to 2026-08-06, when no such trigger existed at all.
begin;
set local lock_timeout      = '3s';
set local statement_timeout = '30s';

alter table public.warehouse_counts
  disable trigger trg_recalc_open_order_lines;

commit;
```

بعد التنفيذ، تأكيد فوري:

```sql
select t.tgname, t.tgenabled
  from pg_trigger t
 where t.tgrelid = 'public.warehouse_counts'::regclass
   and not t.tgisinternal;
-- المتوقع: tgenabled = 'D'
```

> إن فشل الأمر بـ`55P03 lock_not_available`، فهناك معاملة طويلة قائمة. أعِد المحاولة بعد دقيقة. لا تزد `lock_timeout`.
> إن فشل بـ`42704 trigger does not exist`، فالتريغر ليس بهذا الاسم — اقرأ فحص **T1** في الـPRE-FLIGHT قبل أي إجراء آخر.

---

## 2. سكربت الـ PRE-FLIGHT — للقراءة فقط · يُلصق كما هو

يُشغَّل في Supabase SQL Editor بالدور الذي سينفّذ النشر. **لا يعدّل أي بيانات.** كل فحص معزول داخل معالج استثناء، فأي فحص يفشل (عمود مفقود، جدول غير موجود) يظهر كصف `ERROR ...` بدل أن يُسقط السكربت كله.

المخرَج شبكة واحدة: `ord | check_name | observed | stop_condition`.

```sql
-- =====================================================================
-- PRE-FLIGHT  ·  READ ONLY  ·  Almond warehouse hotfix + RPC lock-down
-- Paste and run as one script. Read EVERY row before deploying anything.
-- Rows beginning with "ERROR " mean the object/column does not exist —
-- that is itself a finding, usually a blocking one.
-- =====================================================================
set statement_timeout = '180s';

create or replace function pg_temp.pf_run()
returns table (ord int, check_name text, observed text, stop_condition text)
language plpgsql
as $fn$
declare
  r record;
  v text;
begin
  for r in
    select * from (values

      (1, $q$F1 · target functions that do NOT exist in public$q$,
       $q$select coalesce(string_agg(n.name, E'\n' order by n.name), '<none>')
            from (values ('recalc_open_order_lines'),('enforce_dispatch_ceiling'),
                         ('roastery_stock_adjust'),('enqueue_internal_transfer'),
                         ('handle_new_user'),('set_created_by'),('set_updated_at'),
                         ('custom_access_token_hook'),('assign_warehouse_dispatch_no'),
                         ('assign_warehouse_order_no'),('assign_roastery_order_no')) as n(name)
           where not exists (select 1 from pg_proc p
                               join pg_namespace ns on ns.oid = p.pronamespace
                              where ns.nspname = 'public' and p.proname = n.name)$q$,
       $q$STOP if not <none>. Every REVOKE / ALTER FUNCTION on a missing function raises 42883 and aborts the WHOLE submission. Delete that exact line from BLOCK 5 and BLOCK 6 before running them.$q$),

      (2, $q$F2 · FULL function inventory (signature, owner, secdef, returns, ACL, config) — ROLLBACK BASELINE$q$,
       $q$select coalesce(string_agg(
                 p.oid::regprocedure::text
                 || E'\n      owner='   || pg_get_userbyid(p.proowner)
                 || ' | secdef='        || p.prosecdef
                 || ' | returns='       || pg_get_function_result(p.oid)
                 || E'\n      acl='     || coalesce(p.proacl::text, '<null => EXECUTE TO PUBLIC>')
                 || E'\n      cfg='     || coalesce(array_to_string(p.proconfig, ' , '), '<none>'),
                 E'\n' order by p.oid::regprocedure::text), '<none>')
            from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public'
             and p.proname in ('recalc_open_order_lines','enforce_dispatch_ceiling',
                               'roastery_stock_adjust','enqueue_internal_transfer',
                               'handle_new_user','set_created_by','set_updated_at',
                               'custom_access_token_hook','assign_warehouse_dispatch_no',
                               'assign_warehouse_order_no','assign_roastery_order_no')$q$,
       $q$NO STOP — this is the ROLLBACK BASELINE for every REVOKE and every ALTER FUNCTION. Copy it out verbatim. STOP if: any owner <> the deploying role while that role is not superuser (42501 mid-script); OR recalc_open_order_lines / enforce_dispatch_ceiling do not return "trigger"; OR roastery_stock_adjust identity args <> (text, numeric); OR custom_access_token_hook takes no argument (the 0808 migration assumed that and it is almost certainly (jsonb)).$q$),

      (3, $q$F3 · overloaded names in public$q$,
       $q$select coalesce(string_agg(s.proname || ' x' || s.cnt, ', '), '<none>')
            from (select p.proname, count(*) as cnt
                    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                   where ns.nspname = 'public'
                     and p.proname in ('recalc_open_order_lines','enforce_dispatch_ceiling',
                                       'roastery_stock_adjust','enqueue_internal_transfer',
                                       'handle_new_user','set_created_by','set_updated_at',
                                       'custom_access_token_hook','assign_warehouse_dispatch_no',
                                       'assign_warehouse_order_no','assign_roastery_order_no')
                   group by 1 having count(*) > 1) s$q$,
       $q$STOP if not <none>: an unqualified REVOKE / ALTER on an overloaded name is ambiguous (42725). Pin the exact identity arguments read from F2.$q$),

      (4, $q$F4 · does auth.uid() exist and is it callable$q$,
       $q$select coalesce((select p.oid::regprocedure::text || ' | returns ' || pg_get_function_result(p.oid)
                            from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                           where ns.nspname = 'auth' and p.proname = 'uid' limit 1),
                         '<auth.uid() NOT FOUND>')
              || ' | schema auth usable by current role: '
              || coalesce(has_schema_privilege('auth','usage')::text,'?')$q$,
       $q$NO STOP — BLOCK 3 falls back to request.jwt.claims->>'sub' if auth.uid() is absent. But if it IS absent, expect audit rows with a NULL actor and say so in the ticket instead of treating it as a regression.$q$),

      (5, $q$C1 · COLUMN EXISTENCE PROBE — every column BLOCK 3 touches$q$,
       $q$select string_agg(x.t || '.' || x.c || ' => ' || coalesce(f.ok, '*** MISSING ***'),
                           E'\n' order by x.t, x.c)
            from (values
                   ('warehouse_pars','max_qty'),('warehouse_pars','min_qty'),
                   ('warehouse_pars','direct_receive'),('warehouse_pars','disabled'),
                   ('warehouse_pars','branch_id'),('warehouse_pars','item_id'),
                   ('warehouse_orders','emergency'),('warehouse_orders','status'),
                   ('warehouse_orders','order_date'),('warehouse_orders','branch_id'),
                   ('warehouse_orders','order_no'),
                   ('warehouse_order_lines','suggested'),('warehouse_order_lines','dispatched'),
                   ('warehouse_order_lines','source'),('warehouse_order_lines','added_on'),
                   ('warehouse_order_lines','order_id'),('warehouse_order_lines','item_id'),
                   ('warehouse_counts','qty'),('warehouse_counts','count_date'),
                   ('warehouse_counts','updated_at'),('warehouse_counts','branch_id'),
                   ('warehouse_counts','item_id'),
                   ('audit_log','user_id'),('audit_log','action'),('audit_log','details'),
                   ('audit_log','before_value'),('audit_log','after_value'),
                   ('audit_log','device'),('audit_log','created_at')
                 ) as x(t,c)
            left join lateral (
                  select 'ok' as ok from information_schema.columns ic
                   where ic.table_schema = 'public' and ic.table_name = x.t
                     and ic.column_name = x.c limit 1) f on true$q$,
       $q$STOP on ANY "*** MISSING ***". A plpgsql body is only syntax-checked at CREATE time — a missing column does not fail the deploy, it fails at the FIRST stock-count edit, i.e. it breaks the very operation we are protecting. Remove that column from BLOCK 3 before pasting (for audit_log.device: delete the column and its value from both INSERT statements).$q$),

      (6, $q$C2 · does public.users exist (FK hardening in BLOCK 3)$q$,
       $q$select coalesce(to_regclass('public.users')::text, '<public.users NOT FOUND>')$q$,
       $q$NO STOP — BLOCK 3 wraps the lookup in an exception handler. Informational only.$q$),

      (10, $q$P1 · ALL policies on warehouse_order_lines — ROLLBACK BASELINE$q$,
       $q$select coalesce(string_agg(
                 p.polname || '  [cmd=' || p.polcmd::text
                 || ', permissive=' || p.polpermissive
                 || ', roles=' || coalesce(array_to_string(array(
                        select rr.rolname from pg_roles rr where rr.oid = any(p.polroles)), ','), 'PUBLIC') || ']'
                 || E'\n      USING: ' || coalesce(pg_get_expr(p.polqual,      p.polrelid), '<null>')
                 || E'\n      CHECK: ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '<null>'),
                 E'\n' order by p.polname), '<none>')
            from pg_policy p
           where p.polrelid = 'public.warehouse_order_lines'::regclass$q$,
       $q$STOP HARD if warehouse_order_lines_update shows permissive=false: the entire premise of migration 0807 was wrong, the OR it added is a RESTRICTION not a widening, and everyone may already be blocked. STOP and re-scope. Otherwise: NO STOP, but this is the ONLY baseline of the policy expressions you will ever have — copy it out verbatim.$q$),

      (11, $q$P2 · orphan policy wol_branch_edit_open$q$,
       $q$select coalesce((select 'PRESENT · USING: '
                            || coalesce(pg_get_expr(p.polqual, p.polrelid), '<null>')
                            || ' · permissive=' || p.polpermissive
                            from pg_policy p
                           where p.polrelid = 'public.warehouse_order_lines'::regclass
                             and p.polname  = 'wol_branch_edit_open' limit 1), '<absent>')$q$,
       $q$If PRESENT: commit 7457fc6b created it and affa6cf9 never dropped it — a PERMISSIVE policy is OR-ed in and widens UPDATE. DO NOT DROP IT IN THIS DEPLOY. It may be the ONLY clause still granting branch users any UPDATE at all after 0807 rewrote the other policy; dropping it could lock out every branch. Record it, compare both USING expressions by hand, decide in a separate change.$q$),

      (12, $q$P3 · helper functions absent from the current update policy (D4 evidence)$q$,
       $q$select coalesce(string_agg(m.helper, ', '), '<none missing>')
            from (select unnest(array['is_admin','is_hq','is_hq_ops','is_ops','is_warehouse_ops',
                                      'is_roastery_ops','is_logistics','current_app_branch']) as helper) m
           where not exists (
                 select 1 from pg_policy p
                  where p.polrelid = 'public.warehouse_order_lines'::regclass
                    and p.polname  = 'warehouse_order_lines_update'
                    and coalesce(pg_get_expr(p.polqual, p.polrelid),'') like '%' || m.helper || '%')$q$,
       $q$NO STOP — evidence only. These helpers are absent from today's USING expression. Whether they were there before 2026-08-07 can ONLY be answered by the PITR snapshot. Do not "restore" them by guesswork.$q$),

      (13, $q$P4 · RLS flags on warehouse_order_lines$q$,
       $q$select 'relrowsecurity=' || c.relrowsecurity || ' , relforcerowsecurity=' || c.relforcerowsecurity
            from pg_class c where c.oid = 'public.warehouse_order_lines'::regclass$q$,
       $q$STOP if relrowsecurity=false: the policies are decoration and the table is wide open to every authenticated user. That is a bigger incident than the one being fixed.$q$),

      (14, $q$G1 · table-level privileges on warehouse_order_lines — ROLLBACK BASELINE$q$,
       $q$select coalesce(string_agg(tp.grantee || ' : ' || tp.privilege_type, E'\n'
                                    order by tp.grantee, tp.privilege_type), '<none>')
            from information_schema.table_privileges tp
           where tp.table_schema = 'public' and tp.table_name = 'warehouse_order_lines'$q$,
       $q$NO STOP — ROLLBACK BASELINE for BLOCK 4. If UPDATE is present for authenticated, D5 is confirmed: any logged-in user can rewrite suggested / source / order_id / item_id whatever RLS says.$q$),

      (15, $q$G2 · column-level privileges on warehouse_order_lines — ROLLBACK BASELINE$q$,
       $q$select coalesce(string_agg(cp.grantee || ' : ' || cp.privilege_type || ' : ' || cp.column_name,
                                    E'\n' order by cp.grantee, cp.column_name), '<none>')
            from information_schema.column_privileges cp
           where cp.table_schema = 'public' and cp.table_name = 'warehouse_order_lines'
             and cp.privilege_type in ('UPDATE','INSERT')
             and cp.grantee in ('anon','authenticated','service_role','PUBLIC')$q$,
       $q$NO STOP — ROLLBACK BASELINE for BLOCK 4.$q$),

      (16, $q$T1 · triggers on the three affected tables$q$,
       $q$select coalesce(string_agg(t.tgname || '  [tgenabled=' || t.tgenabled::text || ']'
                                    || E'\n      ' || pg_get_triggerdef(t.oid),
                                    E'\n' order by t.tgrelid::regclass::text, t.tgname), '<none>')
            from pg_trigger t
           where t.tgrelid in ('public.warehouse_counts'::regclass,
                               'public.warehouse_order_lines'::regclass,
                               'public.warehouse_orders'::regclass)
             and not t.tgisinternal$q$,
       $q$Expect trg_recalc_open_order_lines with tgenabled='D' (BLOCK 0 already ran). STOP if any OTHER trigger also writes warehouse_order_lines — cascading recursion. STOP if a trigger you did not disable shows tgenabled<>'O': someone intervened manually and the migration files no longer describe production.$q$),

      (17, $q$I1 · indexes on warehouse_order_lines$q$,
       $q$select coalesce(string_agg(i.indexname || ': ' || i.indexdef, E'\n' order by i.indexname), '<none>')
            from pg_indexes i
           where i.schemaname = 'public' and i.tablename = 'warehouse_order_lines'$q$,
       $q$BLOCKING (soft): if no index leads on order_id, or none on item_id, the recalc loop seq-scans the table and holds row locks for its duration — a real deadlock window against the dispatch path (D11). Run BLOCK 2 first, CONCURRENTLY, never inside a transaction.$q$),

      (20, $q$V1 · warehouse_orders.status distribution + open-line counts$q$,
       $q$select coalesce(string_agg(s.status || ' : ' || s.orders || ' orders, '
                                    || s.open_lines || ' undispatched lines, first=' || s.f
                                    || ', last=' || s.l, E'\n' order by s.orders desc), '<none>')
            from (select wo.status,
                         count(distinct wo.id)                                as orders,
                         count(*) filter (where wol.dispatched is null)       as open_lines,
                         min(wo.order_date)::text                             as f,
                         max(wo.order_date)::text                             as l
                    from public.warehouse_orders wo
                    left join public.warehouse_order_lines wol on wol.order_id = wo.id
                   group by wo.status) s$q$,
       $q$DECISION INPUT for BLOCK 3. If any status OTHER than 'ready' carries undispatched lines and is genuinely pre-dispatch (draft / submitted / new), add it to c_open_statuses in BLOCK 3 BEFORE pasting, otherwise the new trigger is a silent no-op for those orders. NEVER go back to a blocklist: 'received' must never be recalculated.$q$),

      (21, $q$V2 · duplicate (branch_id, item_id, count_date) in warehouse_counts$q$,
       $q$select coalesce((select count(*)::text from (
                    select 1 from public.warehouse_counts
                     group by branch_id, item_id, count_date having count(*) > 1) d), '0')
              || ' duplicate keys'$q$,
       $q$NO STOP. If > 0, the tie-break (updated_at desc nulls last, id desc) in BLOCK 3 is load-bearing, not cosmetic — do not simplify it. If 0, consider a unique constraint in a later change.$q$),

      (22, $q$V3 · is there really an "order only below min_qty" rule$q$,
       $q$select 'below_min=' || count(*) filter (where g.qty <  p.min_qty)
              || ' | at_or_above_min=' || count(*) filter (where g.qty >= p.min_qty)
              || ' | no_min_configured=' || count(*) filter (where p.min_qty is null)
            from public.warehouse_order_lines wol
            join public.warehouse_orders wo on wo.id = wol.order_id
            join public.warehouse_pars   p  on p.branch_id = wo.branch_id
                                           and p.item_id   = wol.item_id
            left join lateral (
                  select wc.qty from public.warehouse_counts wc
                   where wc.branch_id = wo.branch_id and wc.item_id = wol.item_id
                     and wc.count_date <= wo.order_date
                   order by wc.count_date desc, wc.updated_at desc nulls last, wc.id desc
                   limit 1) g on true
           where wol.source = 'count' and wol.dispatched is null and wo.status = 'ready'$q$,
       $q$NO STOP — evidence only. If at_or_above_min = 0 the rule is probably real, but it is STILL not implemented in this deploy: BLOCK 3 only flags such lines in lines_needing_min_review. Enforcing it is a separate, human-approved change.$q$),

      (23, $q$D1 · warehouse_pars rows with max_qty IS NULL$q$,
       $q$select (select count(*) from public.warehouse_pars where max_qty is null)::text
              || ' of ' || (select count(*) from public.warehouse_pars)::text
              || ' par rows, across '
              || (select count(distinct branch_id) from public.warehouse_pars where max_qty is null)::text
              || ' branches'$q$,
       $q$NO STOP for the deploy (BLOCK 3 skips and logs them). But every one of these rows was silently driving suggested to 0 under the deployed code — the branch received nothing. Attach the count to the change ticket and open a separate task to fill in the missing ceilings.$q$),

      (24, $q$D9 · inputs the recalc must not touch$q$,
       $q$select 'min_qty IS NULL: '  || (select count(*) from public.warehouse_pars where min_qty is null)
              || ' | direct_receive=true: ' || (select count(*) from public.warehouse_pars where direct_receive)
              || ' | disabled=true: '       || (select count(*) from public.warehouse_pars where disabled)
              || ' | open emergency orders: '
              || (select count(*) from public.warehouse_orders where emergency and status = 'ready')$q$,
       $q$NO STOP — BLOCK 3 already excludes emergency, direct_receive and disabled pars. This row only quantifies how much damage the deployed version was doing to those three categories.$q$),

      (25, $q$X1 · blast radius already realised$q$,
       $q$select (select count(*) from public.warehouse_order_lines wol
                  join public.warehouse_orders wo on wo.id = wol.order_id
                  left join public.warehouse_pars p on p.branch_id = wo.branch_id
                                                   and p.item_id   = wol.item_id
                 where wol.source = 'count' and wol.dispatched is null
                   and wo.status not in ('dispatched','cancelled') and p.max_qty is null)::text
              || ' open lines exposed to NULL-max_qty zeroing | '
              || (select count(*) from public.warehouse_order_lines wol
                    join public.warehouse_orders wo on wo.id = wol.order_id
                   where wo.status = 'received' and wol.source = 'count')::text
              || ' received lines that the status blocklist could rewrite (D2)'$q$,
       $q$STOP if either number > 0 and no data-repair plan is attached to the ticket. Fixing the code does not un-corrupt rows already written, and the pre-trigger suggested values are NOT in audit_log — recovery needs PITR.$q$),

      (26, $q$A1 · audit_log.user_id shape + recalc activity so far$q$,
       $q$select 'is_nullable=' || coalesce((select ic.is_nullable from information_schema.columns ic
                                             where ic.table_schema='public' and ic.table_name='audit_log'
                                               and ic.column_name='user_id'), '?')
              || ' | type=' || coalesce((select format_type(a.atttypid, a.atttypmod)
                                           from pg_attribute a
                                          where a.attrelid = 'public.audit_log'::regclass
                                            and a.attname = 'user_id'), '?')
              || ' | fk=' || coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                                        where c.conrelid = 'public.audit_log'::regclass
                                          and c.contype = 'f'
                                          and c.conkey @> array[(select a.attnum from pg_attribute a
                                                                  where a.attrelid='public.audit_log'::regclass
                                                                    and a.attname='user_id')]::smallint[]
                                        limit 1), '<none>')
              || ' | recalc rows total=' || (select count(*) from public.audit_log
                                              where action = 'warehouse_order_lines.recalc_from_count')
              || ' | of which NULL user=' || (select count(*) from public.audit_log
                                               where action = 'warehouse_order_lines.recalc_from_count'
                                                 and user_id is null)$q$,
       $q$STOP if is_nullable=NO: the deployed trigger would have been raising 23502 on every count edit, which means the real production symptom differs from our model — re-diagnose. STOP also if total recalc rows = 0 while counts were edited since 2026-08-07: the trigger never fired and something else caused the damage. If fk points at auth.users rather than public.users, note it — BLOCK 3 handles both.$q$),

      (27, $q$R1 · required roles present$q$,
       $q$select coalesce(string_agg(rr.rolname, ', ' order by rr.rolname), '<none>')
            from pg_roles rr
           where rr.rolname in ('anon','authenticated','service_role','authenticator',
                                'postgres','supabase_admin','supabase_auth_admin')$q$,
       $q$STOP if service_role is missing (the re-GRANT in BLOCK 5 fails and Odoo sync dies) or if anon / authenticated are missing (the REVOKE fails 42704 and aborts the block).$q$),

      (28, $q$S1 · effective search_path defaults (D7)$q$,
       $q$select coalesce((select string_agg(coalesce(d.datname,'ALL DBs') || ' / '
                                            || coalesce(rr.rolname,'ALL ROLES') || ' => '
                                            || array_to_string(s.setconfig, ' | '), E'\n')
                            from pg_db_role_setting s
                            left join pg_database d  on d.oid  = s.setdatabase
                            left join pg_roles    rr on rr.oid = s.setrole), '<none>')
              || E'\n      current session search_path = ' || current_setting('search_path')$q$,
       $q$NO STOP, but read it: the committee pins pg_catalog, public, extensions, pg_temp. If the real default carries a schema not in that list (e.g. graphql_public), any unqualified reference to it inside a pinned function will start failing 42883/42P01 at runtime. Cross-check against the function bodies before BLOCK 6.$q$),

      (29, $q$S2 · unqualified cross-schema references inside the target functions$q$,
       $q$select coalesce(string_agg(p.proname || ' => ' ||
                 case when p.prosrc ~* '(^|[^.[:alnum:]_])(auth|storage|graphql|vault|realtime|net)\.'
                      then 'references another schema — check qualification'
                      else 'no obvious cross-schema reference' end,
                 E'\n' order by p.proname), '<none>')
            from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public'
             and p.proname in ('set_updated_at','set_created_by','handle_new_user',
                               'enqueue_internal_transfer','enforce_dispatch_ceiling',
                               'assign_warehouse_dispatch_no','assign_warehouse_order_no',
                               'assign_roastery_order_no','roastery_stock_adjust')$q$,
       $q$NO STOP by itself — but for every function flagged here, read its body with pg_get_functiondef BEFORE BLOCK 6. If a name is used UNQUALIFIED and its schema is not in the pinned path, pinning search_path will break it at runtime. Qualify the body first, in its own change.$q$),

      (30, $q$L1 · long-running transactions right now$q$,
       $q$select coalesce(string_agg(a.pid || ' ' || coalesce(a.state,'?')
                                    || ' age=' || age(now(), a.xact_start)::text
                                    || ' :: ' || left(regexp_replace(coalesce(a.query,''), '\s+', ' ', 'g'), 80),
                                    E'\n'), '<none>')
            from pg_stat_activity a
           where a.xact_start < now() - interval '30 seconds'
             and a.pid <> pg_backend_pid()$q$,
       $q$STOP if not <none>: ALTER TABLE and REVOKE need heavy locks and will queue behind it, and every branch request then queues behind that queue. Wait for a clear window.$q$),

      (31, $q$L2 · current dispatch activity$q$,
       $q$select (select count(*) from public.warehouse_orders where status = 'ready')::text
              || ' ready orders | '
              || (select count(*) from public.warehouse_orders
                   where status = 'dispatched' and order_date = current_date)::text
              || ' dispatched today'$q$,
       $q$STOP if dispatch is actively running right now. The ceiling trigger takes a BEFORE UPDATE hook on the exact rows dispatch is writing; deploy outside that window.$q$),

      (32, $q$M1 · applied migrations around the incident$q$,
       $q$select coalesce(string_agg(m.version || ' ' || coalesce(m.name,''), E'\n' order by m.version), '<none>')
            from supabase_migrations.schema_migrations m
           where m.version like '2026080%'$q$,
       $q$NO STOP — this pins the exact moment to restore to with PITR. If 20260808_lock_down_rpc appears here, it was already applied despite the broken line 22: re-verify F2 before doing anything.$q$)

    ) as t(o, n, q, s)
    order by 1
  loop
    begin
      execute r.q into v;
    exception when others then
      v := 'ERROR ' || sqlstate || ': ' || sqlerrm;
    end;
    ord            := r.o;
    check_name     := r.n;
    observed       := coalesce(v, '<null>');
    stop_condition := r.s;
    return next;
  end loop;
end
$fn$;

select * from pg_temp.pf_run() order by ord;
```

### فحصان لا يمكن إجراؤهما من SQL — إلزاميان يدويا

**1. تسجيل خطاف المصادقة** — Dashboard → Authentication → Hooks → *Customize Access Token (JWT) Claims*.
إن كان `custom_access_token_hook` مسجَّلا فعلا: **تأكيد إضافي أن BLOCK 8 مؤجَّل** (وهو مؤجَّل أصلا في هذه الخطة).

**2. من ينادي ماذا عبر REST** — Logs Explorer، نافذة `2026-07-01 → الآن`:

```sql
-- Supabase Logs Explorer · edge_logs
-- (a) is roastery_stock_adjust called from the web at all, and by which role?
select count(*) as calls, req.method, resp.status_code
from edge_logs as t
cross join unnest(t.metadata) as m
cross join unnest(m.request)  as req
cross join unnest(m.response) as resp
where req.url like '%/rest/v1/rpc/roastery_stock_adjust%'
group by req.method, resp.status_code
order by calls desc;

-- (b) which columns do real users PATCH on warehouse_order_lines?
--     If any request body carries "suggested" or "source", BLOCK 4 will break it.
select t.timestamp, req.method, req.url, resp.status_code
from edge_logs as t
cross join unnest(t.metadata) as m
cross join unnest(m.request)  as req
cross join unnest(m.response) as resp
where req.url like '%warehouse_order_lines%'
  and req.method in ('PATCH','POST')
order by t.timestamp desc
limit 200;
```

---

## 3. استخراج نص السياسة الأصلية — PITR · قراءة فقط · **عاجل**

`ALTER POLICY` كتب فوق `pg_policy.polqual` في مكانه. PostgreSQL **لا يحتفظ بأي نسخة تاريخية**، والمستودع لا يحوي التعريف الأصلي في أي هجرة. نافذة احتفاظ Supabase محدودة (أيام إلى أسابيع) ومضى على الحادثة يوم واحد فقط.

1. **Dashboard → Database → Backups → Restore to a new project** (أو Branching). **لا تسترجع فوق الإنتاج** — ذلك يُفقد كل الطلبيات والجرد منذ 07-08.
2. نقطة الاستعادة: **`2026-08-06 23:59:59 UTC`** (أو دقيقة واحدة على الأقل قبل `version` الهجرة من الفحص M1).
3. على النسخة المستعادة، شغّل هذا وحده:

```sql
-- RUN ON THE PITR CLONE ONLY — never on production.
select p.polname,
       p.polcmd::text                                   as cmd,
       p.polpermissive                                  as is_permissive,
       coalesce(array_to_string(array(
         select rr.rolname from pg_roles rr
          where rr.oid = any(p.polroles)), ','), 'PUBLIC')  as roles,
       pg_get_expr(p.polqual,      p.polrelid)          as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid)          as with_check_expr
  from pg_policy p
 where p.polrelid = 'public.warehouse_order_lines'::regclass
 order by p.polname;
```

4. بديل: في مخرَج `pg_dump` المنطقي ابحث عن الكتلة:

```bash
grep -n -B 2 -A 12 'ON public.warehouse_order_lines' backup.sql
```

5. احفظ الناتج حرفيا في تذكرة التغيير. **هذا هو الأساس الوحيد الممكن لأي تعديل مستقبلي على السياسة.**

> **STOP:** إن تعذّر استخراج التعبير الأصلي، لا يُنشر أي تعديل على أي سياسة إطلاقا. الحماية تأتي حينها من BLOCK 4 وحده.

---

## 4. الكتل التصحيحية

> **معنى التصنيفين:**
> **SAFE** = يُلصق كما هو بعد أن يمر الـPRE-FLIGHT بلا شرط STOP.
> **NEEDS-VERIFICATION-FIRST** = يحتاج قرارا بشريا على صف محدد من مخرَج الـPRE-FLIGHT، أو تعديلا في نص الكتلة قبل اللصق. الصفوف المطلوبة مذكورة في رأس كل كتلة.

> **قواعد التنفيذ العامة (تنطبق على كل الكتل):**
> - كل كتلة **إرسال منفصل** في SQL Editor. لا تُجمع كتلتان في لصقة واحدة — لو كان المحرر في وضع autocommit، فشلُ الثانية يترك الأولى مطبَّقة بلا تراجع.
> - `begin;` و`commit;` مكتوبان صراحة في كل كتلة معاملاتية، ولا تُحذف.
> - `set local lock_timeout` هو صمام الأمان الحقيقي: بدونه ينتظر DDL قفلا حصريا فتتكدس خلفه كل طلبات الفروع.
> - **استعمل `create or replace function` دائما، ولا تستعمل `drop function` أبدا في هذا النشر.** `CREATE OR REPLACE` يحافظ على المالك و`proacl` و`proconfig`؛ أما `DROP` ثم `CREATE` **فيعيد الـACL إلى `EXECUTE TO PUBLIC`** ويُبطل كل التشديد بصمت.
> - `CREATE INDEX CONCURRENTLY` **لا يُنفَّذ داخل معاملة** ولا مع أي جملة أخرى في نفس الإرسال (خطأ 25001).

---

### BLOCK 1 — التقاط الأساس · **SAFE**

يكتب في مخطط خاص `deploy_ops` (وليس `public`، لأن `public` مكشوف عبر PostgREST). لا يمسّ أي جدول إنتاج.

```sql
-- BLOCK 1 · SAFE · capture the rollback baseline. Writes only inside deploy_ops.
begin;
set local lock_timeout      = '3s';
set local statement_timeout = '60s';

create schema if not exists deploy_ops;
revoke all on schema deploy_ops from public;
revoke all on schema deploy_ops from anon;
revoke all on schema deploy_ops from authenticated;

create table if not exists deploy_ops.baseline_20260808 (
  id          bigserial primary key,
  captured_at timestamptz not null default now(),
  kind        text not null,
  object_name text not null,
  detail      text
);

-- Function ACLs, by NAME (never by a guessed signature).
insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'proacl', p.oid::regprocedure::text, coalesce(p.proacl::text, '<default>')
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('recalc_open_order_lines','enforce_dispatch_ceiling',
                     'roastery_stock_adjust','enqueue_internal_transfer',
                     'handle_new_user','set_created_by','set_updated_at',
                     'custom_access_token_hook','assign_warehouse_dispatch_no',
                     'assign_warehouse_order_no','assign_roastery_order_no');

-- Function search_path / config settings.
insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'proconfig', p.oid::regprocedure::text,
       coalesce(array_to_string(p.proconfig, ','), '<none>')
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('recalc_open_order_lines','enforce_dispatch_ceiling',
                     'roastery_stock_adjust','enqueue_internal_transfer',
                     'handle_new_user','set_created_by','set_updated_at',
                     'custom_access_token_hook','assign_warehouse_dispatch_no',
                     'assign_warehouse_order_no','assign_roastery_order_no');

-- Full text of every function we may need to restore verbatim.
insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'functiondef', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('recalc_open_order_lines','enforce_dispatch_ceiling',
                     'roastery_stock_adjust','custom_access_token_hook',
                     'set_created_by','handle_new_user');

-- Every policy on the table: expression, check, roles, permissive flag.
insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'policy_using', p.polname, coalesce(pg_get_expr(p.polqual, p.polrelid), '<null>')
  from pg_policy p where p.polrelid = 'public.warehouse_order_lines'::regclass;

insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'policy_check', p.polname, coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '<null>')
  from pg_policy p where p.polrelid = 'public.warehouse_order_lines'::regclass;

insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'policy_meta', p.polname,
       'cmd=' || p.polcmd::text || '; permissive=' || p.polpermissive ||
       '; roles=' || coalesce(array_to_string(array(
             select rr.rolname from pg_roles rr where rr.oid = any(p.polroles)), ','), 'PUBLIC')
  from pg_policy p where p.polrelid = 'public.warehouse_order_lines'::regclass;

-- Table- and column-level grants.
insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'tablepriv', tp.grantee, tp.privilege_type
  from information_schema.table_privileges tp
 where tp.table_schema = 'public' and tp.table_name = 'warehouse_order_lines';

insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'colpriv', cp.grantee, cp.privilege_type || ':' || cp.column_name
  from information_schema.column_privileges cp
 where cp.table_schema = 'public' and cp.table_name = 'warehouse_order_lines';

-- Trigger definitions.
insert into deploy_ops.baseline_20260808 (kind, object_name, detail)
select 'triggerdef', t.tgname, pg_get_triggerdef(t.oid) || ' [tgenabled=' || t.tgenabled::text || ']'
  from pg_trigger t
 where t.tgrelid in ('public.warehouse_counts'::regclass,
                     'public.warehouse_order_lines'::regclass,
                     'public.warehouse_orders'::regclass)
   and not t.tgisinternal;

commit;
```

ثم **إلزاميا**، صدّر الناتج خارج القاعدة (Run ثم Download CSV):

```sql
select id, captured_at, kind, object_name, detail
  from deploy_ops.baseline_20260808
 order by id;
```

> **لا يبدأ أي شيء بعد هذه النقطة قبل وجود ملف CSV محفوظ خارج قاعدة البيانات.**

---

### BLOCK 2 — الفهارس · **NEEDS-VERIFICATION-FIRST** (الفحص I1)

**اقرأ الفحص 17 (I1) أولا.** نفّذ فقط السطر الخاص بالفهرس المفقود فعلا.
**كل جملة في إرسال منفصل، بلا `begin`، بلا أي جملة أخرى معها.**

```sql
-- BLOCK 2a · run ALONE, no transaction. Skip if I1 already shows an index leading on order_id.
create index concurrently if not exists idx_wol_order_id
  on public.warehouse_order_lines (order_id);
```

```sql
-- BLOCK 2b · run ALONE, no transaction. Skip if I1 already shows an index leading on item_id.
create index concurrently if not exists idx_wol_item_id
  on public.warehouse_order_lines (item_id);
```

تحقق بعدها:

```sql
select i.indexname, i.indexdef, x.indisvalid
  from pg_indexes i
  join pg_class c   on c.relname = i.indexname
  join pg_index x   on x.indexrelid = c.oid
 where i.schemaname = 'public' and i.tablename = 'warehouse_order_lines'
 order by i.indexname;
-- FAIL if indisvalid = false: a CONCURRENTLY build failed and left an invalid index.
-- Then: drop index concurrently public.<name>;  and retry outside peak hours.
```

---

### BLOCK 3 — الدالة المصحَّحة والتريغر · **NEEDS-VERIFICATION-FIRST** (الفحصان C1 و V1)

**تعديلان إلزاميان قبل اللصق:**
1. **من الفحص V1:** إن كانت هناك حالة تمهيدية أخرى غير `'ready'` تحمل أسطرا غير مصروفة، أضِفها إلى `c_open_statuses`، مثلا `array['ready','submitted']`. **لا تعُد إلى قائمة حظر أبدا** — `'received'` يجب ألا تُعاد حسابها.
2. **من الفحص C1:** إن ظهر `audit_log.device` كـ`MISSING`، احذف `device` وقيمته `'db-trigger:recalc_open_order_lines'` من **كلا** أمري `insert` أدناه. وإن ظهر أي عمود آخر مفقودا، **توقف** وأبلغ اللجنة — لا تحذفه من منطق الحساب.

هذه الكتلة **تُعيد إنشاء التريغر مفعَّلا**، فهي التي تُلغي أثر BLOCK 0.

```sql
-- =====================================================================
-- BLOCK 3 · file: supabase/migrations/20260809_fix_recalc_open_order_lines.sql
-- Corrects public.recalc_open_order_lines() — defects D1, D2, D3, D9, D10, D11.
-- Writes NO data. Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- Re-enables the trigger that BLOCK 0 disabled.
-- =====================================================================
begin;
set local lock_timeout      = '5s';
set local statement_timeout = '60s';

create or replace function public.recalc_open_order_lines()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  -- D2: ALLOW-list of statuses that are still open. Extend ONLY per PRE-FLIGHT V1.
  -- Never turn this into a block-list: 'received' must never be recalculated.
  c_open_statuses constant text[]   := array['ready'];
  c_max_detail    constant integer  := 200;   -- bound the audit jsonb size

  v_rec            record;
  v_new            numeric;
  v_rows           integer;
  v_updated        integer := 0;
  v_before_lines   jsonb   := '[]'::jsonb;
  v_after_lines    jsonb   := '[]'::jsonb;
  v_skipped_no_par text[]  := '{}';
  v_needs_review   text[]  := '{}';
  v_actor          uuid;
  v_actor_raw      uuid;
  v_claims         jsonb;
begin
  ---------------------------------------------------------------------------
  -- D10 · who did it.
  -- auth.uid() first; request.jwt.claims->>'sub' as the fallback. Both are
  -- wrapped: a missing helper must NEVER be able to abort a stock correction.
  ---------------------------------------------------------------------------
  begin
    v_actor_raw := auth.uid();
  exception when others then
    v_actor_raw := null;
  end;

  if v_actor_raw is null then
    begin
      v_claims    := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
      v_actor_raw := nullif(v_claims ->> 'sub', '')::uuid;
    exception when others then
      v_actor_raw := null;
    end;
  end if;

  v_actor := v_actor_raw;

  -- FK hardening: if the id has no matching row, keep it in details only,
  -- so a foreign key can never abort the count correction.
  if v_actor is not null then
    begin
      if not exists (select 1 from public.users u where u.id = v_actor) then
        v_actor := null;
      end if;
    exception when others then
      null;   -- public.users absent or unreadable: leave v_actor as read
    end;
  end if;

  ---------------------------------------------------------------------------
  -- D1 (qty side) · a NULL count is not a zero count. Change nothing, log loudly.
  ---------------------------------------------------------------------------
  if new.qty is null then
    insert into public.audit_log
      (user_id, action, details, before_value, after_value, device, created_at)
    values
      (v_actor,
       'warehouse_order_lines.recalc_skipped',
       jsonb_build_object(
         'reason',     'count qty is null',
         'count_id',   new.id,
         'branch_id',  new.branch_id,
         'item_id',    new.item_id,
         'count_date', new.count_date,
         'actor_uid',  v_actor_raw,
         'db_user',    current_user),
       jsonb_build_object('count_qty', old.qty),
       jsonb_build_object('count_qty', new.qty),
       'db-trigger:recalc_open_order_lines',
       now());
    return new;
  end if;

  ---------------------------------------------------------------------------
  -- Candidate lines, in ascending id order (D11: deterministic lock order).
  -- UPDATE ... FROM accepts no ORDER BY, and SELECT ... FOR UPDATE does not
  -- guarantee lock order under a Sort node. A row-by-row loop is the only
  -- real guarantee. Affected rows per (branch,item) are very few.
  ---------------------------------------------------------------------------
  for v_rec in
    select wol.id        as line_id,
           wol.suggested as old_suggested,
           wo.order_no   as order_no,
           p.max_qty     as max_qty,
           p.min_qty     as min_qty
      from public.warehouse_order_lines wol
      join public.warehouse_orders      wo on wo.id = wol.order_id
      join public.warehouse_pars        p  on p.branch_id = wo.branch_id
                                          and p.item_id   = wol.item_id
     where wol.item_id    = new.item_id
       and wo.branch_id   = new.branch_id
       and wol.source     = 'count'
       and wol.dispatched is null
       and wo.status      = any (c_open_statuses)                  -- D2
       and coalesce(wo.emergency, false)     = false               -- D9
       and coalesce(p.disabled, false)       = false
       and coalesce(p.direct_receive, false) = false               -- D9
       and wo.order_date >= new.count_date
       -- D3: this count must BE the governing count for that order date,
       -- i.e. the most recent count at or before wo.order_date. Without this,
       -- an OLDER count can overwrite an order built on a NEWER one.
       and new.id = (
             select wc.id
               from public.warehouse_counts wc
              where wc.branch_id  = new.branch_id
                and wc.item_id    = new.item_id
                and wc.count_date <= wo.order_date
              order by wc.count_date desc,
                       wc.updated_at desc nulls last,
                       wc.id        desc
              limit 1)
     order by wol.id                                               -- D11
  loop
    ------------------------------------------------------------------------
    -- D1 · no ceiling configured -> no computable recommendation.
    -- Skip and log. We do NOT raise: that would fail the stock correction
    -- itself, which is a legitimate operation unrelated to this defect.
    ------------------------------------------------------------------------
    if v_rec.max_qty is null then
      v_skipped_no_par := v_skipped_no_par || v_rec.line_id::text;
      continue;
    end if;

    v_new := greatest(0, least(v_rec.max_qty, v_rec.max_qty - new.qty));

    ------------------------------------------------------------------------
    -- D9 · min_qty is OBSERVED, never ENFORCED, until the rule is confirmed.
    ------------------------------------------------------------------------
    if v_rec.min_qty is not null and new.qty >= v_rec.min_qty then
      v_needs_review := v_needs_review || v_rec.line_id::text;
    end if;

    if v_rec.old_suggested is distinct from v_new then
      -- Re-check the open conditions inside the write: the dispatch path may
      -- have moved the order between the scan and this update.
      update public.warehouse_order_lines wol
         set suggested = v_new
       where wol.id = v_rec.line_id
         and wol.dispatched is null
         and exists (select 1
                       from public.warehouse_orders wo
                      where wo.id     = wol.order_id
                        and wo.status = any (c_open_statuses));
      get diagnostics v_rows = row_count;

      if v_rows = 1 then
        v_updated := v_updated + 1;
        if jsonb_array_length(v_before_lines) < c_max_detail then
          v_before_lines := v_before_lines || jsonb_build_object(
            'line_id', v_rec.line_id, 'order_no', v_rec.order_no,
            'suggested', v_rec.old_suggested);
          v_after_lines  := v_after_lines  || jsonb_build_object(
            'line_id', v_rec.line_id, 'order_no', v_rec.order_no,
            'suggested', v_new);
        end if;
      end if;
    end if;
  end loop;

  ---------------------------------------------------------------------------
  -- One audit row, carrying the actor AND per-line before/after values, so a
  -- bad recalculation is reversible from the log alone. The live version
  -- stored count_qty only, which is why the damage already done is NOT
  -- recoverable from audit_log. We do not repeat that mistake.
  ---------------------------------------------------------------------------
  if v_updated > 0
     or cardinality(v_skipped_no_par) > 0
     or cardinality(v_needs_review)   > 0 then
    insert into public.audit_log
      (user_id, action, details, before_value, after_value, device, created_at)
    values
      (v_actor,
       'warehouse_order_lines.recalc_from_count',
       jsonb_build_object(
         'count_id',                 new.id,
         'branch_id',                new.branch_id,
         'item_id',                  new.item_id,
         'count_date',               new.count_date,
         'lines_updated',            v_updated,
         'lines_skipped_no_max_qty', to_jsonb(v_skipped_no_par),
         'lines_needing_min_review', to_jsonb(v_needs_review),
         'detail_truncated',         (v_updated > c_max_detail),
         'actor_uid',                v_actor_raw,
         'db_user',                  current_user),
       jsonb_build_object('count_qty', old.qty, 'lines', v_before_lines),
       jsonb_build_object('count_qty', new.qty, 'lines', v_after_lines),
       'db-trigger:recalc_open_order_lines',
       now());
  end if;

  return new;
end;
$fn$;

comment on function public.recalc_open_order_lines() is
  'Recalculates suggested on OPEN (status in c_open_statuses, not dispatched, '
  'non-emergency, non direct_receive, par not disabled) count-sourced order '
  'lines, and only when the corrected count is the GOVERNING count for that '
  'order date. Skips lines whose warehouse_pars.max_qty is NULL. Never applies '
  'a min_qty rule; only flags lines for human review.';

-- Scope unchanged on purpose: UPDATE OF qty only. Changing count_date /
-- item_id / branch_id, or INSERTing a newer count after the order was built,
-- still do NOT recalculate. Widening that scope is a separate decision.
-- A NULL new.qty still fires, so it is audited as skipped instead of passing
-- silently.
drop trigger if exists trg_recalc_open_order_lines on public.warehouse_counts;

create trigger trg_recalc_open_order_lines
after update of qty on public.warehouse_counts
for each row
when (old.qty is distinct from new.qty)
execute function public.recalc_open_order_lines();

commit;
```

تحقق فوري:

```sql
select t.tgname, t.tgenabled, p.proconfig, p.prosecdef
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid = 'public.warehouse_counts'::regclass
   and not t.tgisinternal;
-- المتوقع: tgenabled='O' · prosecdef=true
-- proconfig = {"search_path=pg_catalog, public, extensions, pg_temp"}
```

**ثم نفّذ اختبارات الدخان §6 قبل الانتقال إلى BLOCK 4. لا استثناء.**

---

### BLOCK 4 — صلاحيات الأعمدة على `warehouse_order_lines` · **NEEDS-VERIFICATION-FIRST** (G1, G2, Edge Logs (ب))

**العمود القابل للتحرير بشريا هو `dispatched` وليس `suggested`.** الأدلة: `trg_enforce_dispatch_ceiling` هو `BEFORE INSERT OR UPDATE OF dispatched` ويقصّ `dispatched` وحده؛ `chk_dispatched_nonneg` يمنع السالب على `dispatched` وحده؛ ودليل التشغيل الموزَّع على الفروع يصف حرفيا سلوك `dispatched` («أعلى من الحد الأعلى → تُقصّ، سالبة → مرفوضة»). أما `suggested` فعمود يملكه النظام: أي تعديل بشري عليه يُمحى عند أول تصحيح جرد ويفسد خط الأساس.

**شرط اللصق:** أن يُظهر Edge Logs (فحص ب) أنه **لا يوجد** طلب `PATCH` من مستخدم حقيقي يحمل `"suggested"` أو `"source"` في جسمه. إن وُجد، **توقف** — ذلك المسار يُستوعب عبر RPC مخصَّص، لا بتوسيع المنحة.

**تحذير جوهري:** في Supabase كل المستخدمين المسجَّلين يصلون بدور قاعدة بيانات واحد هو `authenticated`؛ «فرع/عمليات/مستودع» مجرد مطالبات JWT. لذلك هذه المنحة تُقيّد **الجميع** لا الفروع وحدها. هذا مقبول ومقصود.

```sql
-- BLOCK 4 · NEEDS-VERIFICATION-FIRST (G1, G2, Edge Logs)
-- Revoke and re-grant MUST be in one transaction: doing them separately opens a
-- window in which every branch edit fails with 42501.
begin;
set local lock_timeout      = '5s';
set local statement_timeout = '30s';

-- 1) Drop table-level UPDATE (it covers every current AND future column).
revoke update on table public.warehouse_order_lines from authenticated;
revoke update on table public.warehouse_order_lines from anon;
revoke update on table public.warehouse_order_lines from public;

-- 2) Grant back ONLY the human-editable quantity column.
grant update (dispatched) on table public.warehouse_order_lines to authenticated;

-- 3) service_role keeps full access: backend jobs and the Odoo sync depend on it.
grant update on table public.warehouse_order_lines to service_role;

commit;
```

بعدها `suggested`, `source`, `order_id`, `item_id`, `added_on`, `id` تصبح **غير قابلة للتحديث من أي جلسة مستخدم**، مهما اتسع شرط RLS. **`SELECT` لم يُمسّ** (القراءة تبقى محكومة بسياسات `_select`)، و`INSERT` لم يُمسّ.

تحقق:

```sql
select cp.grantee, cp.privilege_type, cp.column_name
  from information_schema.column_privileges cp
 where cp.table_schema = 'public' and cp.table_name = 'warehouse_order_lines'
   and cp.privilege_type = 'UPDATE'
 order by cp.grantee, cp.column_name;
-- المتوقع: authenticated => dispatched فقط. لا anon. service_role على كل الأعمدة.
```

---

### BLOCK 4b — إعادة تحميل كاش PostgREST · **SAFE**

يُنفَّذ **بعد `commit`، في إرسال منفصل**، بعد كل كتلة غيّرت صلاحيات أو سياسات أو توقيع دالة (أي بعد BLOCK 4 وبعد BLOCK 5/6).
`NOTIFY` معامَلاتي، فوضعه بالخارج يتيح إعادة إطلاقه وحده ويمنع الخلط بين «المعاملة تراجعت» و«الكاش لم يُحدَّث».

```sql
-- BLOCK 4b · SAFE · run as its OWN submission, after COMMIT.
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
```

> بدون هذا: سحب `EXECUTE` يبقى غير مرئي، ومنح الأعمدة الجديدة تبقى غير مرئية، فيرى المستخدم إما نجاحا كاذبا أو `PGRST202` لدالة موجودة فعلا.

---

### BLOCK 5 — سحب `EXECUTE` من `PUBLIC` · **NEEDS-VERIFICATION-FIRST** (F1, F2, F3, Edge Logs (أ))

**لماذا `revoke ... from anon` وحدها عبارة لا أثر لها:** PostgreSQL يمنح `EXECUTE` إلى **`PUBLIC`** تلقائيا عند إنشاء أي دالة، و`anon` عضو في `PUBLIC`. السحب من `anon` وحده يترك منحة `PUBLIC` قائمة. الدليل في الكتالوج: `proacl IS NULL` تعني «لا ACL صريح» أي «PUBLIC يملك EXECUTE».

**تعديلان إلزاميان قبل اللصق:**
1. **من الفحص F1:** احذف سطر أي دالة غير موجودة. وجود سطر واحد لدالة مفقودة يرفع `42883` **ويُلغي الكتلة بأكملها**.
2. **من الفحص F2:** استبدل `(text, numeric)` في أسطر `roastery_stock_adjust` بالتوقيع الحقيقي المقروء.
3. **من Edge Logs (أ):** إن ظهر نداء حيّ بدور `anon` أو `authenticated` على `roastery_stock_adjust`، **لا تنفّذ سطر السحب منه** حتى يُنشر فحص التفويض داخل الجسم (BLOCK 7، مؤجَّل) — وإلا كسرت عميلا حيّا.

**سحب `EXECUTE` من دوال المشغّلات لا يعطّل المشغّلات:** PostgreSQL يفحص صلاحية `EXECUTE` عند `CREATE TRIGGER` فقط، لا عند كل إطلاق.

```sql
-- BLOCK 5 · NEEDS-VERIFICATION-FIRST (F1, F2, F3, Edge Logs)
-- Delete any line whose function F1 reported as missing, and fix any signature
-- that differs from F2, BEFORE running this.
begin;
set local lock_timeout      = '5s';
set local statement_timeout = '30s';

-- ---- the RPC that was reachable from the web -----------------------------
-- Revoking from PUBLIC is the actual fix; anon/authenticated are named
-- explicitly because Supabase may have granted them directly.
revoke execute on function public.roastery_stock_adjust(text, numeric) from public;
revoke execute on function public.roastery_stock_adjust(text, numeric) from anon;
revoke execute on function public.roastery_stock_adjust(text, numeric) from authenticated;

-- MANDATORY re-grant: service_role is a member of PUBLIC, so the revoke above
-- stripped it too. Without this line the Odoo sync stops immediately.
grant execute on function public.roastery_stock_adjust(text, numeric) to service_role;

-- ---- trigger functions: nobody should be able to call these directly -----
revoke execute on function public.recalc_open_order_lines()      from public, anon, authenticated;
revoke execute on function public.enforce_dispatch_ceiling()     from public, anon, authenticated;
revoke execute on function public.enqueue_internal_transfer()    from public, anon, authenticated;
revoke execute on function public.handle_new_user()              from public, anon, authenticated;
revoke execute on function public.set_created_by()               from public, anon, authenticated;
revoke execute on function public.set_updated_at()               from public, anon, authenticated;
revoke execute on function public.assign_warehouse_dispatch_no() from public, anon, authenticated;
revoke execute on function public.assign_warehouse_order_no()    from public, anon, authenticated;
revoke execute on function public.assign_roastery_order_no()     from public, anon, authenticated;

-- The owner (postgres) always keeps EXECUTE; no grant needed here.
-- custom_access_token_hook is DELIBERATELY absent — see "ما يُمنع تطبيقه الآن".

commit;
```

ثم أعد تشغيل **BLOCK 4b**.

> **تحذير دائم يجب أن يُكتب في تذكرة التغيير:** `CREATE OR REPLACE FUNCTION` **يحافظ** على الـACL، أما `DROP` ثم `CREATE` **فيعيده إلى الافتراضي** أي `PUBLIC` يستعيد `EXECUTE` بصمت. أي هجرة مستقبلية تُسقط إحدى هذه الدوال يجب أن تُعيد تنفيذ BLOCK 5 في نفس المعاملة.

---

### BLOCK 6 — تثبيت `search_path` · **NEEDS-VERIFICATION-FIRST** (F1, F2, S1, S2 + قراءة الأجسام)

**القيمة المعتمدة: `pg_catalog, public, extensions, pg_temp`.**

| العنصر | لماذا |
|---|---|
| `pg_catalog` أولا صراحة | يمنع تظليل دوال النظام |
| `public` ثم `extensions` | افتراضي Supabase هو `"$user", public, extensions`. **إسقاط `extensions` يكسر أي نداء غير مؤهَّل لدالة امتداد** (`gen_random_uuid()`, `uuid_generate_v4()`, `crypt()`, معاملات `pg_trgm`) بخطأ `42883` **عند التشغيل** لا عند الترحيل — وهذا بالضبط عطل ملف 0807 الذي كتب `= public` |
| `pg_temp` **آخرا وصراحة** | إن لم يُذكر، يُبحث فيه **أولا، قبل `pg_catalog` نفسه**. أي أن `= public` لا تمنع التظليل إطلاقا. ذكره أخيرا هو ما يُبطلها |

**شرط اللصق:** لكل دالة يشير إليها الفحص S2 بـ«references another schema»، اقرأ جسمها بـ`pg_get_functiondef` وتأكد أن كل اسم إما مؤهَّل بمخططه أو موجود في المسار أعلاه. إن وُجد اسم غير مؤهَّل من مخطط خارج المسار، **احذف سطر تلك الدالة** — تأهيل الأسماء داخل جسمها يسبق تثبيت المسار، وهو تغيير منفصل.

```sql
-- BLOCK 6 · NEEDS-VERIFICATION-FIRST (F1, F2, S1, S2 + reading the bodies)
-- Delete the line of any function that F1 reported missing, or whose body
-- S2 flagged and you have not yet verified.
begin;
set local lock_timeout      = '5s';
set local statement_timeout = '30s';

alter function public.set_updated_at()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.set_created_by()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.handle_new_user()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.enqueue_internal_transfer()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.assign_warehouse_dispatch_no()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.assign_warehouse_order_no()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.assign_roastery_order_no()
  set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.roastery_stock_adjust(text, numeric)
  set search_path = pg_catalog, public, extensions, pg_temp;

-- Fixes the function that migration 0807 shipped with the truncated path
-- "= public" and that is in production right now.
-- (recalc_open_order_lines already carries the correct value from BLOCK 3.)
alter function public.enforce_dispatch_ceiling()
  set search_path = pg_catalog, public, extensions, pg_temp;

-- custom_access_token_hook is DELIBERATELY EXCLUDED — see "ما يُمنع تطبيقه الآن".

commit;
```

ثم أعد تشغيل **BLOCK 4b**، ثم تحقق:

```sql
select p.oid::regprocedure::text as fn,
       coalesce(array_to_string(p.proconfig, ' , '), '<none>') as cfg,
       coalesce(p.proacl::text, '<null => EXECUTE TO PUBLIC>') as acl
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('recalc_open_order_lines','enforce_dispatch_ceiling',
                     'roastery_stock_adjust','enqueue_internal_transfer',
                     'handle_new_user','set_created_by','set_updated_at',
                     'assign_warehouse_dispatch_no','assign_warehouse_order_no',
                     'assign_roastery_order_no','custom_access_token_hook')
 order by 1;
-- FAIL إذا ظهر '<null => EXECUTE TO PUBLIC>' على أي دالة عولجت في BLOCK 5.
-- المتوقع: custom_access_token_hook وحدها بلا تغيير — وهذا مقصود.
```

---

### BLOCK 7 — فحص التفويض داخل `roastery_stock_adjust` · **مؤجَّل — NEEDS-VERIFICATION-FIRST (E-Q1, E-Q2)**

**لا يُطبَّق في هذا النشر.** الدالة `SECURITY DEFINER` أي **تتجاوز RLS**؛ سحب المنح (BLOCK 5) يوقف النداء المباشر، لكن أي دور يُمنح `EXECUTE` لاحقا سيستطيع تحريك المخزون بلا قيد. الفحص داخل الجسم هو الحاجز الذي لا يسقط بتغيير منحة — لكنه يحتاج نص الجسم الأصلي، وهو **غير متاح لنا**.

الاستعلامان اللازمان قبل كتابته:

```sql
-- E-Q1 · exact body and exact parameter names.
-- CREATE OR REPLACE cannot change parameter names: any mismatch raises
-- "cannot change name of input parameter".
select pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.proname = 'roastery_stock_adjust';

-- E-Q2 · do the helper functions work inside a SECURITY DEFINER context?
-- Inside SECURITY DEFINER, current_user is the OWNER, not the caller. A helper
-- that reads current_user is meaningless there; it must read the JWT claims
-- via current_setting('request.jwt.claims', true).
select p.oid::regprocedure, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('is_admin','is_roastery_ops','current_app_role');
```

الهيكل المعتمد عند كتابته لاحقا (بوابة تفويض + تحقق مدخلات + أثر تدقيقي، ثم الجسم الأصلي حرفيا):

```sql
-- BLOCK 7 · DO NOT RUN YET. Requires the verbatim body from E-Q1.
-- Paste the original body at the marked position, unchanged.
-- Use the parameter names exactly as E-Q1 reports them (p_ref/p_delta assumed).
-- Use CREATE OR REPLACE only — DROP + CREATE would hand EXECUTE back to PUBLIC.

create or replace function public.roastery_stock_adjust(p_ref text, p_delta numeric)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $fn$
declare
  v_claims   jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_jwt_role text  := coalesce(v_claims ->> 'role', '');
begin
  -- Authorization gate: fail loudly rather than move stock without a right to.
  if not (
        v_jwt_role = 'service_role'                    -- backend / Odoo sync
     or session_user in ('postgres', 'service_role')   -- direct maintenance
     or is_admin()
     or is_roastery_ops()
  ) then
    raise exception
      'roastery_stock_adjust: unauthorized (app_role=%, jwt_role=%)',
      coalesce(current_app_role(), '-'), coalesce(nullif(v_jwt_role, ''), '-')
      using errcode = '42501';
  end if;

  if p_ref is null or btrim(p_ref) = '' then
    raise exception 'roastery_stock_adjust: p_ref is required' using errcode = '22023';
  end if;
  if p_delta is null then
    raise exception 'roastery_stock_adjust: p_delta is required' using errcode = '22023';
  end if;

  insert into public.audit_log (user_id, action, details, created_at)
  values (
    nullif(v_claims ->> 'sub', '')::uuid,
    'roastery_stock_adjust',
    jsonb_build_object('p_ref', p_ref, 'p_delta', p_delta, 'jwt_role', v_jwt_role),
    now()
  );

  ---------------------------------------------------------------------------
  -- >>>>>> PASTE THE ORIGINAL BODY FROM E-Q1 HERE, UNCHANGED <<<<<<
  ---------------------------------------------------------------------------

end;
$fn$;

revoke execute on function public.roastery_stock_adjust(text, numeric) from public, anon, authenticated;
grant  execute on function public.roastery_stock_adjust(text, numeric) to   service_role;
```

> **يجب التحقق أولا:** أن `audit_log.user_id` يقبل `NULL` (نداء `service_role` بلا `sub`)، وأن نوعه `uuid`. إن كان هناك مفتاح أجنبي إلى `users(id)` فسيفشل الإدراج لمعرّفات غير موجودة — عندها ضع `user_id = null` واحتفظ بـ`sub` داخل `details` فقط. الفحص **A1** يجيب على هذا.

---

### BLOCK 8 — خطاف المصادقة · **مؤجَّل — لا يُطبَّق في هذا النشر**

`custom_access_token_hook` هي خطاف GoTrue، يستدعيها خادم المصادقة بدور `supabase_auth_admin` عند **كل إصدار أو تجديد لرمز دخول**. إن رفعت استثناء لأي سبب — ومنه فشل تحليل اسم بسبب `search_path` مغيَّر — فإن:

* **لا أحد يستطيع تسجيل الدخول:** لا الفروع، ولا العمليات، ولا المدير، ولا أنت.
* **الجلسات القائمة تسقط** عند أول تجديد (خلال ساعة عادة)، فيبدو العطل «متأخرا» ويصعب ربطه بالهجرة.
* لا يمكن الإصلاح عبر أي واجهة تعتمد على المصادقة؛ يلزم `psql` أو SQL Editor باتصال مباشر.

شروط نافذتها المستقبلية، كلها إلزامية: هجرة منفصلة تماما · خارج ساعات الذروة · بعد تجربة على فرع Supabase مع تسجيل دخول فعلي · مع إبقاء جلسة `psql` مفتوحة · وأمر التراجع جاهز على الشاشة · وبعد قراءة `pg_get_functiondef` كاملا والتأكد أن كل اسم في الجسم مؤهَّل بمخططه · وبالتوقيع الحقيقي المقروء من الفحص F2 (وليس `()` كما في ملف 0808).

---

## 5. التراجع (Rollback)

يُحضَّر ويُفتح في تبويب جاهز **قبل** بدء النشر. أوامر التراجع مرتبة بالأولوية.

### 5.1 تراجع BLOCK 3 — الأسرع، ثوانٍ · **المفضَّل: تعطيل لا استعادة**

```sql
-- ROLLBACK 3 (preferred) · stop the new trigger, leave the data layer still.
-- Restoring the OLD body would put D1, D2 and D3 straight back into production.
begin;
set local lock_timeout = '3s';
alter table public.warehouse_counts disable trigger trg_recalc_open_order_lines;
commit;
```

لإعادة التمكين لاحقا:

```sql
alter table public.warehouse_counts enable trigger trg_recalc_open_order_lines;
```

وإن طُلب صراحة إرجاع سلوك 2026-08-07 حرفيا (وهو **غير موصى به**):

```sql
begin;
set local lock_timeout = '3s';
do $$
declare d text;
begin
  select b.detail into d
    from deploy_ops.baseline_20260808 b
   where b.kind = 'functiondef'
     and b.object_name like 'recalc_open_order_lines%'
   order by b.id limit 1;
  if d is null then
    raise exception 'no baseline functiondef for recalc_open_order_lines — ABORT, do not guess';
  end if;
  execute d;   -- pg_get_functiondef emits a complete CREATE OR REPLACE
end $$;
commit;
```

### 5.2 تراجع BLOCK 4 — صلاحيات الأعمدة

```sql
-- ROLLBACK 4 · restore the exact grants captured in BLOCK 1.
begin;
set local lock_timeout = '3s';

revoke update on table public.warehouse_order_lines from authenticated;

do $$
declare r record;
begin
  -- table-level UPDATE grants as they were
  for r in
    select b.object_name as grantee
      from deploy_ops.baseline_20260808 b
     where b.kind = 'tablepriv' and b.detail = 'UPDATE'
       and b.object_name in ('anon','authenticated','service_role','PUBLIC')
  loop
    execute format('grant update on table public.warehouse_order_lines to %s',
                   case when r.grantee = 'PUBLIC' then 'public'
                        else quote_ident(r.grantee) end);
  end loop;

  -- column-level UPDATE grants as they were
  for r in
    select b.object_name as grantee, split_part(b.detail, ':', 2) as col
      from deploy_ops.baseline_20260808 b
     where b.kind = 'colpriv' and split_part(b.detail, ':', 1) = 'UPDATE'
       and b.object_name in ('anon','authenticated','service_role','PUBLIC')
  loop
    execute format('grant update (%I) on table public.warehouse_order_lines to %s',
                   r.col,
                   case when r.grantee = 'PUBLIC' then 'public'
                        else quote_ident(r.grantee) end);
  end loop;
end $$;

commit;
```
ثم **BLOCK 4b**.

### 5.3 تراجع BLOCK 5 — صلاحيات التنفيذ

```sql
-- ROLLBACK 5 · rebuild EXECUTE privileges literally from the captured proacl.
begin;
set local lock_timeout = '3s';

do $$
declare r record; a record;
begin
  for r in select b.object_name, b.detail
             from deploy_ops.baseline_20260808 b
            where b.kind = 'proacl'
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',
                   r.object_name);
    if r.detail = '<default>' then
      execute format('grant execute on function %s to public', r.object_name);
    else
      for a in select * from aclexplode(r.detail::aclitem[])
      loop
        if a.privilege_type = 'EXECUTE' then
          execute format('grant execute on function %s to %s',
                         r.object_name,
                         case when a.grantee = 0 then 'public'
                              else quote_ident(pg_get_userbyid(a.grantee)) end);
        end if;
      end loop;
    end if;
  end loop;
end $$;

commit;
```
ثم **BLOCK 4b**.

### 5.4 تراجع BLOCK 6 — `search_path`

```sql
-- ROLLBACK 6 · restore each function's original config, or RESET if it had none.
begin;
set local lock_timeout = '3s';

do $$
declare r record;
begin
  for r in select b.object_name, b.detail
             from deploy_ops.baseline_20260808 b
            where b.kind = 'proconfig'
              and b.object_name not like 'custom_access_token_hook%'
  loop
    if r.detail = '<none>' then
      execute format('alter function %s reset search_path', r.object_name);
    else
      execute format('alter function %s set %s', r.object_name, r.detail);
    end if;
  end loop;
end $$;

commit;
```
ثم **BLOCK 4b**.

### 5.5 تراجع BLOCK 2 — الفهارس

```sql
-- Each statement ALONE, outside any transaction.
drop index concurrently if exists public.idx_wol_order_id;
```
```sql
drop index concurrently if exists public.idx_wol_item_id;
```
> عمليا: **لا تُسقط الفهارس.** وجودها غير ضار، وإسقاطها يعيد خطر التعارض (deadlock).

### 5.6 التنظيف — بعد 7 أيام من الاستقرار، لا قبل

```sql
drop schema deploy_ops cascade;   -- ONLY after the CSV is archived outside the database
```

---

## 6. اختبارات الدخان — بعد كل كتلة، 5 دقائق

```sql
-- SMOKE 1 · the trigger fires and records the actor (D10).
-- First perform one REAL stock-count edit from the application, then:
select a.id, a.user_id, a.action, a.details, a.before_value, a.after_value, a.created_at
  from public.audit_log a
 where a.action in ('warehouse_order_lines.recalc_from_count',
                    'warehouse_order_lines.recalc_skipped')
   and a.created_at > now() - interval '10 minutes'
 order by a.created_at desc;
-- FAIL if no row appears at all.
-- FAIL if user_id IS NULL *and* details->>'actor_uid' is also null while the
--      edit came from a logged-in user (identity plumbing is broken).
```

```sql
-- SMOKE 2 · nothing outside the allow-list was touched (D2).
select wo.status, count(*) as lines_touched
  from public.audit_log a
  cross join lateral jsonb_array_elements(coalesce(a.after_value -> 'lines', '[]'::jsonb)) l
  join public.warehouse_order_lines wol on wol.id = (l ->> 'line_id')::bigint
  join public.warehouse_orders wo       on wo.id  = wol.order_id
 where a.action = 'warehouse_order_lines.recalc_from_count'
   and a.created_at > now() - interval '10 minutes'
 group by wo.status;
-- FAIL if 'received', 'dispatched' or 'cancelled' appears.
-- (If line_id is not bigint in this schema, cast to the real type.)
```

```sql
-- SMOKE 3 · no silent zeroing (D1).
select count(*) as silently_zeroed
  from public.warehouse_order_lines wol
  join public.warehouse_orders wo on wo.id = wol.order_id
  left join public.warehouse_pars p on p.branch_id = wo.branch_id
                                   and p.item_id   = wol.item_id
 where wol.source = 'count'
   and wol.dispatched is null
   and wo.status = 'ready'
   and wol.suggested = 0
   and p.max_qty is null
   and wol.added_on >= current_date - 1;
-- FAIL if > 0.
```

```sql
-- SMOKE 4 · privilege state after BLOCK 5 / BLOCK 6.
select p.oid::regprocedure::text as fn,
       coalesce(p.proacl::text, '<default = EXECUTE TO PUBLIC>') as acl,
       coalesce(array_to_string(p.proconfig, ' , '), '<none>')   as cfg
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.proname = 'roastery_stock_adjust';
-- FAIL if acl shows '<default = EXECUTE TO PUBLIC>', or anon=X, or authenticated=X.
-- FAIL if service_role=X is absent — the backend just lost access.
```

**اختبار من جانب العميل (إلزامي بعد BLOCK 5، بمفتاح `anon` الحقيقي):**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "$SUPABASE_URL/rest/v1/rpc/roastery_stock_adjust" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H 'Content-Type: application/json' -d '{"p_ref":"SMOKE","p_delta":0}'
# المتوقع: 404 (PGRST202) أو 403.  أي 200 => القفل لم ينجح => تراجع فوري (§5.3).
```

**اختبار بشري بعد BLOCK 4 (إلزامي):** سجّل دخولا حقيقيا بحساب فرع واحد، ثم:
- عدّل `dispatched` على سطر مفتوح → **يجب أن ينجح**.
- حاول تعديل `suggested` على نفس السطر → **يجب أن يُرفض بـ`42501` / 403**.

---

## 7. مراقبة الـ24 ساعة

### 7.1 مرشّحات السجلات

```sql
-- Supabase Logs Explorer · postgres_logs
-- SQLSTATE codes that mean "roll back now".
select t.timestamp, parsed.error_severity, parsed.sql_state_code,
       parsed.user_name, parsed.query, t.event_message
from postgres_logs as t
cross join unnest(t.metadata) as m
cross join unnest(m.parsed)   as parsed
where parsed.sql_state_code in (
        '42501',  -- insufficient_privilege : BLOCK 4/5 broke a real user
        '42883',  -- undefined_function     : search_path dropped extensions
        '42P01',  -- undefined_table        : search_path dropped a schema
        '3F000',  -- invalid_schema_name
        '23502',  -- not_null_violation     : audit_log.user_id
        '23514',  -- check_violation        : chk_dispatched_nonneg
        '40P01',  -- deadlock_detected      : D11
        '55P03',  -- lock_not_available     : lock_timeout during the deploy
        '57014'   -- query_canceled         : statement_timeout
      )
  and t.timestamp > timestamp_sub(current_timestamp(), interval 24 hour)
order by t.timestamp desc;
```

```sql
-- Supabase Logs Explorer · edge_logs · REST failures.
select t.timestamp, req.method, req.url, resp.status_code
from edge_logs as t
cross join unnest(t.metadata) as m
cross join unnest(m.request)  as req
cross join unnest(m.response) as resp
where resp.status_code >= 400
  and (req.url like '%/rest/v1/rpc/%' or req.url like '%warehouse_order_lines%')
order by t.timestamp desc;
-- Watch specifically: PGRST202 (function missing from the cache -> you forgot
-- BLOCK 4b), PGRST203 (ambiguous overload), 403 on warehouse_order_lines
-- (BLOCK 4 narrowed more than intended).
```

> سجلّات المصادقة **ليست** ضمن المراقبة لأن خطاف المصادقة لم يُمسّ في هذا النشر. إن نُفِّذ BLOCK 8 لاحقا فهي أول ما يُراقَب.

### 7.2 عدّادات دورية (كل ساعة)

```sql
-- Deadlocks must not increase. Index scans on the new indexes must.
select d.datname, d.deadlocks, d.xact_rollback, now() as at
  from pg_stat_database d
 where d.datname = current_database();

select ui.relname, ui.indexrelname, ui.idx_scan, ui.idx_tup_read
  from pg_stat_user_indexes ui
 where ui.relname = 'warehouse_order_lines'
 order by ui.indexrelname;
```

### 7.3 استعلام الحقيقة — عند T+1h و T+4h و T+24h

```sql
-- Does the corrected trigger behave? One row of verdicts.
with recalcs as (
  select a.id,
         a.user_id,
         a.created_at,
         (a.details ->> 'branch_id')::uuid                 as branch_id,
         (a.details ->> 'item_id')::uuid                   as item_id,
         (a.details ->> 'count_date')::date                as count_date,
         (a.details ->> 'lines_updated')::int              as lines_updated,
         jsonb_array_length(coalesce(a.details -> 'lines_skipped_no_max_qty', '[]'::jsonb)) as skipped_no_max,
         jsonb_array_length(coalesce(a.details -> 'lines_needing_min_review', '[]'::jsonb)) as needs_min_review,
         (a.details ->> 'actor_uid')                       as actor_uid,
         (a.before_value ->> 'count_qty')::numeric         as qty_before,
         (a.after_value  ->> 'count_qty')::numeric         as qty_after
    from public.audit_log a
   where a.action = 'warehouse_order_lines.recalc_from_count'
     and a.created_at > now() - interval '24 hours'
)
select count(*)                                                  as total_recalcs,
       count(*) filter (where user_id is null and actor_uid is null) as fail_no_actor,
       count(*) filter (where lines_updated = 0
                          and skipped_no_max = 0
                          and needs_min_review = 0)              as fail_noise_rows,
       count(*) filter (where lines_updated > 200)               as fail_suspicious_mass,
       count(*) filter (where qty_before is null)                as fail_missing_before,
       sum(skipped_no_max)                                       as lines_skipped_no_max_qty,
       sum(needs_min_review)                                     as lines_flagged_min_review,
       max(lines_updated)                                        as max_lines_touched,
       count(distinct branch_id)                                 as branches,
       min(created_at)                                           as first_seen,
       max(created_at)                                           as last_seen
  from recalcs;
-- All four fail_* columns must be 0.
-- lines_skipped_no_max_qty > 0 is EXPECTED and is the D1 backlog: it feeds the
-- separate task of filling in the missing warehouse_pars.max_qty ceilings.
```

```sql
-- The invariant query. Expected result after the fix: ZERO ROWS.
-- Any row = immediate investigation, do not close the ticket.
select wo.order_no, wo.status, wo.emergency, i.name_ar,
       wol.suggested, p.max_qty, p.min_qty,
       g.qty as governing_qty, g.count_date as governing_count_date, wo.order_date
  from public.warehouse_order_lines wol
  join public.warehouse_orders wo on wo.id = wol.order_id
  join public.items i             on i.id  = wol.item_id
  left join public.warehouse_pars p on p.branch_id = wo.branch_id
                                   and p.item_id   = wol.item_id
  left join lateral (
        select wc.qty, wc.count_date
          from public.warehouse_counts wc
         where wc.branch_id = wo.branch_id and wc.item_id = wol.item_id
           and wc.count_date <= wo.order_date
         order by wc.count_date desc, wc.updated_at desc nulls last, wc.id desc
         limit 1) g on true
 where wol.source = 'count'
   and wol.dispatched is null
   and wo.status = 'ready'
   and wo.order_date >= current_date - 1
   and (
        p.max_qty is null                                          -- would have been silently zeroed
        or wol.suggested < 0                                       -- impossible under the new rule
        or (not coalesce(wo.emergency,false) and wol.suggested > p.max_qty)  -- above par without an emergency
        or wol.suggested is distinct from
             greatest(0, least(p.max_qty, p.max_qty - g.qty))      -- inconsistent with the governing count (D3)
       )
 order by wo.order_no, i.name_ar;
```

### 7.4 نقاط القرار وعتبات التراجع

| اللحظة | ما يُفحص | عتبة التراجع الفوري |
|---|---|---|
| T+5m بعد BLOCK 3 | SMOKE 1/2/3 | لا صف تدقيق، أو `received` مُسّت، أو تصفير صامت → **§5.1** |
| T+5m بعد BLOCK 4 | `42501` / 403 على `warehouse_order_lines` من مستخدم فرع حقيقي | **أي** حالة واحدة → **§5.2** |
| T+5m بعد BLOCK 5 | `curl` بمفتاح anon + استدعاءات RPC الحقيقية | `200` على `roastery_stock_adjust` = القفل فشل؛ `PGRST202` على دوال أخرى → **§5.3** |
| T+5m بعد BLOCK 6 | `42883` / `42P01` / `3F000` في postgres_logs | أي واحدة → **§5.4** |
| T+1h | §7.3 الاستعلام الأول | `fail_no_actor > 0` أو `fail_suspicious_mass > 0` → **§5.1** |
| T+4h | `40P01` + `pg_stat_database.deadlocks` | أي تعارض واحد يشمل `warehouse_order_lines` → **§5.1** |
| T+24h | §7.3 استعلام الثابت (الثاني) | `> 0` صف → تحقيق قبل إغلاق التذكرة. **لا إغلاق بـ«يبدو جيدا»** |

**مسؤول مناوب:** شخص واحد بصلاحية تنفيذ على القاعدة، متاح طوال الـ24 ساعة، وسكربتات §5 مفتوحة أمامه في تبويب جاهز.

---

## 8. جدول التغيّر السلوكي — الدالة الجديدة مقابل النسخة الحية (2026-08-07)

| السلوك | النسخة الحية | بعد BLOCK 3 | الأثر |
|--------|--------------|--------------|-------|
| `max_qty IS NULL` | يكتب `suggested = 0` | لا يلمس السطر + `lines_skipped_no_max_qty` في التدقيق | يوقف تجويع الفروع |
| `new.qty IS NULL` | يكتب `suggested = 0` (لأن `LEAST` تتجاهل `NULL`) | خروج مبكر + قيد `recalc_skipped` | لا كتابة عمياء |
| الحالات المشمولة | كل شيء عدا `dispatched`/`cancelled` — أي `received` مشمولة | `status = any(c_open_statuses)` = `'ready'` فقط | لا إعادة كتابة للتاريخ |
| اختيار الجرد | أي جرد بتاريخ ≤ `order_date` | **الجرد الحاكم فقط** (الأحدث ≤ `order_date`، بفاصل ترجيح حاسم) | جرد قديم لم يعد يكتب فوق أحدث منه |
| الطلبيات الطارئة | تُعاد حسابها وتُقصّ إلى السقف | مستثناة | الطلب الطارئ يبقى فوق الـpar، وهو غرضه |
| `direct_receive` | تُعاد حسابها | مستثناة | لا تدخّل في مسار الاستلام المباشر |
| `min_qty` | مُتجاهل تماما | مُتجاهل في الحساب، لكن السطر يُعلَّم في `lines_needing_min_review` | كشف بلا تغيير دلالي غير مُصادَق عليه |
| `disabled` par | مستثناة | مستثناة | بلا تغيير |
| ترتيب القفل | `UPDATE ... FROM` بلا ترتيب | حلقة بترتيب `wol.id` تصاعديا، تحديث لكل سطر | يزيل خطر التعارض من طرفنا |
| سباق الإرسال | لا فحص عند الكتابة | إعادة فحص `dispatched is null` و`status` **داخل** الـ`UPDATE` | لا نكتب على سطر أُرسِل أثناء التنفيذ |
| `audit_log.user_id` | `NULL` دائما | `auth.uid()` ثم `jwt.sub` احتياطا، مع تحصين FK، و`actor_uid`/`db_user` في `details` | التدقيق يعرف الفاعل |
| محتوى التدقيق | `count_qty` فقط | `count_qty` + `suggested` قبل/بعد لكل سطر (بحد 200) | التغيير صار قابلا للعكس من السجل |
| توقيت التسجيل | فقط عند وجود تحديث | أيضا عند وجود تخطٍّ أو أسطر تحتاج مراجعة | الحالات الصامتة صارت مرئية |
| `search_path` | `public` | `pg_catalog, public, extensions, pg_temp` + تأهيل كامل بالمخطط | لا إسقاط لـ`extensions` ولا تظليل عبر `pg_temp` أو `pg_catalog` |
| نطاق التريغر | `UPDATE OF qty` | كما هو، بلا توسيع صامت | تغيير `count_date` أو إدراج جرد جديد ما زالا غير مُعالَجين — **قرار منفصل مفتوح** |

---

## 9. متابعات مفتوحة (بعد استقرار النشر)

1. **مسار الإرسال (dispatch) يجب أن يعتمد نفس ترتيب `id` التصاعدي** عند تحديث `warehouse_order_lines`، وإلا يبقى احتمال التعارض قائما من الطرف الآخر رغم إصلاح D11 من طرفنا.
2. **ملء `warehouse_pars.max_qty` الناقص** للفروع والأصناف التي كشفها الفحص D1 — كل صف منها كان يُحرم فرعا من صنف.
3. **إصلاح البيانات المتضررة** (الأسطر المصفَّرة منذ 07-08) — يحتاج PITR أو نسخة منطقية سابقة، لأن القيم القديمة غير موجودة في `audit_log`.
4. **حسم قاعدة `min_qty`** بناء على مخرَج V3 وقرار بشري موثَّق، ثم تنفيذها كتغيير مستقل.
5. **حسم مصير `wol_branch_edit_open`** وإعادة بناء `warehouse_order_lines_update` بعد وصول نص PITR.
6. **قيد فرادة على `(branch_id, item_id, count_date)`** إن أظهر الفحص V2 صفر تكرار.
7. **هجرة خطاف المصادقة (BLOCK 8)** في نافذتها الخاصة.
8. **حذف/إصلاح `/home/user/almond/supabase/migrations/20260808_lock_down_rpc.sql`** من المستودع حتى لا يُطبَّق سهوا بسطره المعطوب رقم 22.
