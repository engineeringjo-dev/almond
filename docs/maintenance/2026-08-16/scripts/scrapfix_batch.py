# scrapfix_batch.py — تصفية مسودّات stock.scrap العالقة (origin = WASTE-*) — Almond
# ---------------------------------------------------------------------------
# السياق: التصدير اليوميّ يُنشئ stock.scrap للهدر ويصادقه. بعد قرار ١٧٣ (التامّة
# is_storable=false) صار سندُ التامّة بلا أثر، ومسار المخزَّن (الخام) قد يعلق على
# **بوّابة موافقة أودو** (studio.approval → "Some approvals are missing"). تراكمت
# مسودّاتٌ عالقة (~٤٤٨ قياس سابق). هذا السكربت يُصنّفها ويصفّيها بأمان:
#   • untracked (is_storable=false) ⇒ سندٌ ميّت بلا أثر ⇒ يُلغى (unlink) بعد لقطة.
#   • approval  (مخزَّن + رصيدٌ كافٍ + ردّ الموافقة) ⇒ يُحاوَل تصديقه؛ إن بقي عالقاً
#                على الموافقة يُترَك ويُعلَن (لا يُطمَس — هدرٌ حقيقيّ لم يُخصَم).
#   • negative  (مخزَّن + رصيدٌ غير كافٍ) ⇒ needs_human (لا يُعالَج آلياً — صحّح المخزون أولاً).
#
# ⚠️ الأمان (نمط negfix_batch.py المُثبَت):
#   • DRY-RUN افتراضيّ: لا كتابة إطلاقاً إلا عند تعيين البيئة  APPROVE=PROD.
#   • لقطةٌ كاملةٌ لكلّ سجلّ قبل أيّ لمس (scrapfix_backups.jsonl) — شرطٌ لا تنازل.
#   • تدقيقٌ لكلّ كتابة في PROD_AUDIT.jsonl مع علم dry_run/نصّ الموافقة.
#   • حالةٌ قابلةٌ للاستئناف (scrapfix_state.json) — المنجَز لا يُعاد.
#   • حاجزٌ زمنيّ (BUDGET ثوانٍ) لتفادي المهلات؛ يُعاد تشغيله حتى النضوب.
#
# التشغيل:
#   export SCRATCH=/path/to/scratchpad/          # يحوي .odoo_env
#   python3 scrapfix_batch.py 500 4              # جولة تخطيط (DRY-RUN) — راجِع القوائم
#   APPROVE=PROD python3 scrapfix_batch.py 500 4 # تنفيذ فعليّ (بعد موافقة المالك)
#   # كرّر حتى remaining≈0.
# ---------------------------------------------------------------------------
import xmlrpc.client, json, time, sys, os, threading, queue, datetime

P = os.environ.get("SCRATCH", "./")
if not P.endswith("/"):
    P += "/"
DRY_RUN = os.environ.get("APPROVE") != "PROD"
BUDGET = int(sys.argv[1]) if len(sys.argv) > 1 else 500
WORKERS = int(sys.argv[2]) if len(sys.argv) > 2 else 4
COMPANIES = [1, 2, 3, 4]      # الشركات الأربع (إيفورا/ليريا/ألموند/إيطاليان)
ORIGIN_PREFIX = "WASTE-"      # مرجع الهدر الآليّ (daily-export.ts)
T0 = time.time()

# --- بيئة الاتصال (نفس صيغة negfix_batch.py) ---
env = {}
for ln in open(P + ".odoo_env"):
    ln = ln.strip()
    if not ln or ln.startswith("#"):
        continue
    ln = ln.replace("export ", "", 1)
    k, v = ln.split("=", 1)
    env[k] = v.strip().strip('"').strip("'")
uid = xmlrpc.client.ServerProxy(env["ODOO_URL"] + "/xmlrpc/2/common").authenticate(
    env["ODOO_DB"], env["ODOO_LOGIN"], env["ODOO_API_KEY"], {}
)

LOCK = threading.Lock()
try:
    NS = json.load(open(P + "scrapfix_state.json"))
except Exception:
    NS = {"cancelled": {}, "validated": {}, "approval": {}, "needs_human": {}, "fail": {}}
log = open(P + "scrapfix.log", "a", buffering=1)
BK = open(P + "scrapfix_backups.jsonl", "a", buffering=1)
AUD = open(P + "PROD_AUDIT.jsonl", "a", buffering=1)


def mkkw():
    models = xmlrpc.client.ServerProxy(env["ODOO_URL"] + "/xmlrpc/2/object")

    def kw(m, meth, args, k=None, tries=4):
        for t in range(tries):
            try:
                return models.execute_kw(env["ODOO_DB"], uid, env["ODOO_API_KEY"], m, meth, args, k or {})
            except (xmlrpc.client.Fault, xmlrpc.client.ProtocolError) as e:
                s = str(e)
                if "cannot marshal None" in s:
                    return None
                if ("Access Denied" in s or "503" in s) and t < tries - 1:
                    time.sleep(4 * (t + 1))
                    continue
                raise

    return kw


kw0 = mkkw()
E4 = {"context": {"allowed_company_ids": COMPANIES}}


def now_iso():
    # لا Date.now() ممنوع هنا (بايثون عاديّ) — طابعٌ زمنيّ صريح للتدقيق.
    return datetime.datetime.utcnow().isoformat() + "Z"


def audit(action, d, before, after, note=""):
    AUD.write(json.dumps({
        "ts": now_iso(), "script": "scrapfix", "action": action,
        "scrap_id": d["id"], "origin": d.get("origin"),
        "before": before, "after": after, "note": note,
        "dry_run": DRY_RUN, "approval": "" if DRY_RUN else "APPROVE PROD",
    }, ensure_ascii=False, default=str) + "\n")


def snapshot(d, is_storable, avail):
    BK.write(json.dumps({"ts": now_iso(), "scrap": d, "is_storable": is_storable, "avail": avail},
                        ensure_ascii=False, default=str) + "\n")


def scrap_refusal_reason(res):
    # مكافئ scrapRefusalReason في daily-export.ts: يقرأ params.message من ردّ action_validate.
    if not isinstance(res, dict):
        return None
    msg = (res.get("params") or {}).get("message")
    if isinstance(msg, str) and msg.strip():
        return msg.strip()[:120]
    if res.get("res_model"):
        return "wizard: " + str(res["res_model"])
    return (res.get("name") or res.get("type") or None)


def is_approval(reason):
    return bool(reason) and ("approval" in reason.lower() or "موافق" in reason)


def avail_qty(kw, pid, loc, co):
    E = {"context": {"allowed_company_ids": [co], "company_id": co}}
    qs = kw("stock.quant", "search_read",
            [[["product_id", "=", pid], ["location_id", "=", loc]], ["quantity", "reserved_quantity"]], E) or []
    return sum((q.get("quantity") or 0) - (q.get("reserved_quantity") or 0) for q in qs)


# --- جمع المسودّات + تتبّع المخزون ---
drafts = kw0("stock.scrap", "search_read",
             [[["state", "=", "draft"], ["origin", "=like", ORIGIN_PREFIX + "%"]],
              ["id", "product_id", "scrap_qty", "location_id", "company_id", "origin", "state"]], E4) or []
pids = list({d["product_id"][0] for d in drafts if d.get("product_id")})
storable = {}
for i in range(0, len(pids), 300):
    for r in (kw0("product.product", "read", [pids[i:i + 300], ["is_storable"]], E4) or []):
        storable[r["id"]] = r["is_storable"]

Q = queue.Queue()
for d in drafts:
    sid = str(d["id"])
    if any(sid in NS[k] for k in ("cancelled", "validated", "approval", "needs_human", "fail")):
        continue
    Q.put(d)
print(f"queued drafts: {Q.qsize()} | DRY_RUN={DRY_RUN}")

CNT = {"cancelled": 0, "validated": 0, "approval": 0, "needs_human": 0, "fail": 0}


def worker():
    kw = mkkw()
    while time.time() - T0 < BUDGET:
        try:
            d = Q.get_nowait()
        except queue.Empty:
            return
        sid = str(d["id"])
        if not d.get("product_id"):
            with LOCK:
                NS["needs_human"][sid] = "no product"
                CNT["needs_human"] += 1
            continue
        pid = d["product_id"][0]
        loc = d["location_id"][0] if d.get("location_id") else None
        co = d["company_id"][0] if d.get("company_id") else COMPANIES[0]
        E = {"context": {"allowed_company_ids": [co], "company_id": co}}
        st = storable.get(pid, True)   # مجهول ⇒ يُعامَل مخزَّناً (الحارس: لا تُسقط خصماً بالشكّ)
        try:
            cur = kw("stock.scrap", "read", [[d["id"]], ["state"]], E)
            if not cur or cur[0]["state"] != "draft":
                s2 = cur[0]["state"] if cur else "?"
                with LOCK:
                    (NS["validated"] if s2 == "done" else NS["needs_human"])[sid] = "state:" + s2
                continue

            # (1) غير مخزَّن ⇒ سندٌ ميّت ⇒ لقطة ثمّ إلغاء (تنظيف الضجيج)
            if st is False:
                with LOCK:
                    snapshot(d, st, None)
                if DRY_RUN:
                    with LOCK:
                        NS["cancelled"][sid] = "DRY:would-unlink-untracked"
                        CNT["cancelled"] += 1
                else:
                    kw("stock.scrap", "unlink", [[d["id"]]], E)
                    with LOCK:
                        audit("unlink-untracked", d, {"state": "draft"}, {"state": "deleted"})
                        NS["cancelled"][sid] = "unlinked"
                        CNT["cancelled"] += 1
                continue

            # (2)/(3) مخزَّن ⇒ افحص الرصيد المتاح في الموقع
            avail = avail_qty(kw, pid, loc, co) if loc else 0
            if avail < (d.get("scrap_qty") or 0):
                with LOCK:
                    NS["needs_human"][sid] = f"negative avail={avail} qty={d.get('scrap_qty')}"
                    CNT["needs_human"] += 1
                continue

            with LOCK:
                snapshot(d, st, avail)
            if DRY_RUN:
                with LOCK:
                    NS["approval"][sid] = f"DRY:would-validate avail={avail}"
                    CNT["approval"] += 1
                continue

            # تنفيذ فعليّ: صادِق، اقرأ السبب من الردّ، ثمّ الحالة الفعليّة (لا تخمين)
            res = kw("stock.scrap", "action_validate", [[d["id"]]], E)
            reason = scrap_refusal_reason(res)
            after = kw("stock.scrap", "read", [[d["id"]], ["state"]], E)
            s2 = after[0]["state"] if after else "?"
            with LOCK:
                audit("validate", d, {"state": "draft"}, {"state": s2}, reason or "")
                if s2 == "done":
                    NS["validated"][sid] = "done"
                    CNT["validated"] += 1
                elif is_approval(reason):
                    NS["approval"][sid] = reason           # يبقى معلَّقاً — لا يُطمَس
                    CNT["approval"] += 1
                else:
                    NS["needs_human"][sid] = f"stuck {s2}: {reason}"
                    CNT["needs_human"] += 1
                if sum(CNT.values()) % 25 == 0:
                    json.dump(NS, open(P + "scrapfix_state.json", "w"))
        except Exception as e:
            with LOCK:
                NS["fail"][sid] = str(e)[-140:]
                CNT["fail"] += 1
                log.write(f"scrap{d['id']}: EXC {str(e)[-100:]}\n")


ths = [threading.Thread(target=worker) for _ in range(WORKERS)]
[t.start() for t in ths]
[t.join() for t in ths]
json.dump(NS, open(P + "scrapfix_state.json", "w"))
summary = (f"ROUND cancelled={CNT['cancelled']} validated={CNT['validated']} "
           f"approval={CNT['approval']} needs_human={CNT['needs_human']} fail={CNT['fail']} "
           f"| DRY_RUN={DRY_RUN} | remaining≈{Q.qsize()}")
log.write(summary + "\n")
print(summary)
