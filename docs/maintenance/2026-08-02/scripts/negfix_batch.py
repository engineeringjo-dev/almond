# معالجة جماعية معتمدة حرفياً من المالك حمزة (2026-08-02): حل الخصومات —
# خبز سطر الخصم السالب بأسعار الأسطر، الإجمالي النهائي يبقى مطابقاً للفلس،
# نفس الرقم ونفس التاريخ، ثم الإرسال لبوابة JoFotara. باكاب كامل لكل فاتورة قبل اللمس.
# نجح البايلوت: INV/2026/01131 — إجمالي مطابق + Sent.
import xmlrpc.client, json, time, sys, threading, queue
P='/tmp/claude-0/-home-user-almond/ba59e94f-62c6-5206-8db2-95dabac525e0/scratchpad/'
BUDGET=int(sys.argv[1]) if len(sys.argv)>1 else 500
WORKERS=int(sys.argv[2]) if len(sys.argv)>2 else 6
T0=time.time()
env={}
for ln in open(P+'.odoo_env'):
    ln=ln.strip()
    if not ln or ln.startswith('#'): continue
    ln=ln.replace('export ','',1)
    k,v=ln.split('=',1); env[k]=v.strip().strip('"').strip("'")
uid=xmlrpc.client.ServerProxy(env['ODOO_URL']+'/xmlrpc/2/common').authenticate(env['ODOO_DB'],env['ODOO_LOGIN'],env['ODOO_API_KEY'],{})
LOCK=threading.Lock()
try: NS=json.load(open(P+'negfix_state.json'))
except Exception: NS={'done':{},'skip':{},'fail':{}}
log=open(P+'negfix.log','a',buffering=1)
BK=open(P+'negfix_backups.jsonl','a',buffering=1)
def mkkw():
    models=xmlrpc.client.ServerProxy(env['ODOO_URL']+'/xmlrpc/2/object')
    def kw(m,meth,args,k=None,tries=4):
        for t in range(tries):
            try: return models.execute_kw(env['ODOO_DB'],uid,env['ODOO_API_KEY'],m,meth,args,k or {})
            except (xmlrpc.client.Fault,xmlrpc.client.ProtocolError) as e:
                s=str(e)
                if 'cannot marshal None' in s: return None
                if ('Access Denied' in s or '503' in s) and t<tries-1: time.sleep(4*(t+1)); continue
                raise
    return kw
kw0=mkkw()
ST=json.load(open(P+'jofotara_drain_state.json'))
neg=[int(k) for k,v in ST['errors'].items() if 'negative' in str(v)]
E4={'context':{'allowed_company_ids':[1,2,3,4]}}
meta={}
for i in range(0,len(neg),300):
    for r in kw0('account.move','read',[neg[i:i+300],['move_type','payment_state','company_id']],E4):
        meta[r['id']]=r
Q=queue.Queue()
for iid in neg:
    m=meta.get(iid)
    if not m: continue
    if str(iid) in NS['done'] or str(iid) in NS['skip'] or str(iid) in NS['fail']: continue
    if m['payment_state']!='not_paid':
        NS['skip'][str(iid)]=m['payment_state']; continue
    Q.put((iid,m['company_id'][0]))
print('queued:',Q.qsize())
CNT={'ok':0,'fail':0}
def worker():
    kw=mkkw()
    while time.time()-T0<BUDGET:
        try: iid,co=Q.get_nowait()
        except queue.Empty: return
        E={'context':{'allowed_company_ids':[co],'company_id':co}}
        try:
            mv=kw('account.move','read',[[iid],['name','amount_total','invoice_date','state']],E)[0]
            if mv['state']!='posted':
                with LOCK: NS['skip'][str(iid)]='state:'+str(mv['state'])
                continue
            ll=kw('account.move.line','search_read',[[['move_id','=',iid],['display_type','=','product']],['id','name','product_id','quantity','price_unit','price_subtotal','tax_ids','account_id']],E)
            negl=[l for l in ll if l['price_unit']<0 or l['quantity']<0]
            posl=[l for l in ll if l not in negl]
            gp=sum(l['quantity']*l['price_unit'] for l in posl)
            if not negl or not posl or gp<=0:
                with LOCK: NS['skip'][str(iid)]='structure'
                continue
            with LOCK: BK.write(json.dumps({'move':mv,'lines':ll},ensure_ascii=False,default=str)+'\n')
            target=mv['amount_total']; f=target/gp
            kw('account.move','button_draft',[[iid]],E)
            newpu={}
            for l in posl:
                newpu[l['id']]=round(l['price_unit']*f,4)
                kw('account.move.line','write',[[l['id']],{'price_unit':newpu[l['id']]}],E)
            kw('account.move.line','unlink',[[l['id'] for l in negl]],E)
            m2=kw('account.move','read',[[iid],['amount_total']],E)[0]
            d=round(target-m2['amount_total'],3)
            if abs(d)>0.0005:
                big=max(posl,key=lambda l:l['quantity']*l['price_unit'])
                kw('account.move.line','write',[[big['id']],{'price_unit':round(newpu[big['id']]+d/big['quantity'],4)}],E)
                m2=kw('account.move','read',[[iid],['amount_total']],E)[0]
            if abs(target-m2['amount_total'])>0.001:
                for l in posl: kw('account.move.line','write',[[l['id']],{'price_unit':l['price_unit']}],E)
                for l in negl:
                    kw('account.move.line','create',[{'move_id':iid,'name':l['name'],'product_id':l['product_id'] and l['product_id'][0],'quantity':l['quantity'],'price_unit':l['price_unit'],'tax_ids':[[6,0,l['tax_ids']]],'account_id':l['account_id'] and l['account_id'][0]}],E)
                kw('account.move','action_post',[[iid]],E)
                with LOCK: NS['fail'][str(iid)]='total_mismatch_restored'; CNT['fail']+=1; log.write(f"{mv['name']}: RESTORED (mismatch)\n")
                continue
            kw('account.move','action_post',[[iid]],E)
            m3=kw('account.move','read',[[iid],['name','amount_total','invoice_date']],E)[0]
            if m3['name']!=mv['name'] or abs(m3['amount_total']-target)>0.001 or str(m3['invoice_date'])!=str(mv['invoice_date']):
                with LOCK: NS['fail'][str(iid)]=f"postcheck {m3['name']} {m3['amount_total']}"; CNT['fail']+=1; log.write(f"{mv['name']}: POSTCHECK FAIL\n")
                continue
            ctx={'context':{**E['context'],'active_model':'account.move','active_ids':[iid]}}
            try:
                w=kw('account.move.send.wizard','create',[{}],ctx)
                if not isinstance(w,int): raise xmlrpc.client.Fault(1,'x')
            except xmlrpc.client.Fault:
                c2=kw('account.move.send.wizard','search_read',[[['move_id','=',iid]],['id']],{'context':ctx['context'],'order':'id desc','limit':1})
                w=c2[0]['id'] if c2 else None
            if w:
                try: kw('account.move.send.wizard','write',[[w],{'extra_edis':['jo_edi'],'sending_methods':['manual']}],ctx)
                except Exception: pass
                try: kw('account.move.send.wizard','action_send_and_print',[[w]],ctx,tries=1)
                except xmlrpc.client.Fault: pass
            st=kw('account.move','read',[[iid],['l10n_jo_edi_state','l10n_jo_edi_error']],E)[0]
            with LOCK:
                if st['l10n_jo_edi_state']=='sent':
                    NS['done'][str(iid)]=1; CNT['ok']+=1; log.write(f"{mv['name']}: FIXED+SENT\n")
                else:
                    NS['fail'][str(iid)]=str(st.get('l10n_jo_edi_error'))[:120]; CNT['fail']+=1
                    log.write(f"{mv['name']}: fixed but {st['l10n_jo_edi_state']} | {str(st.get('l10n_jo_edi_error'))[:90]}\n")
                if (CNT['ok']+CNT['fail'])%25==0: json.dump(NS,open(P+'negfix_state.json','w'))
        except Exception as e:
            with LOCK: NS['fail'][str(iid)]=str(e)[-140:]; CNT['fail']+=1; log.write(f"id{iid}: EXC {str(e)[-100:]}\n")
ths=[threading.Thread(target=worker) for _ in range(WORKERS)]
[t.start() for t in ths]; [t.join() for t in ths]
json.dump(NS,open(P+'negfix_state.json','w'))
log.write(f"ROUND ok={CNT['ok']} fail={CNT['fail']} | total done={len(NS['done'])} skip={len(NS['skip'])} fail={len(NS['fail'])}\n")
print(f"ROUND: ok={CNT['ok']} fail={CNT['fail']} | TOTAL done={len(NS['done'])} skip={len(NS['skip'])} fail={len(NS['fail'])} | remaining≈{Q.qsize()}")
