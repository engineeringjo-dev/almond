import xmlrpc.client, json, time, sys
P='/tmp/claude-0/-home-user-almond/ba59e94f-62c6-5206-8db2-95dabac525e0/scratchpad/'
BUDGET=int(sys.argv[1]) if len(sys.argv)>1 else 520
T0=time.time()
env={}
for ln in open(P+'.odoo_env'):
    ln=ln.strip()
    if not ln or ln.startswith('#'): continue
    ln=ln.replace('export ','',1)
    k,v=ln.split('=',1); env[k]=v.strip().strip('"').strip("'")
uid=xmlrpc.client.ServerProxy(env['ODOO_URL']+'/xmlrpc/2/common').authenticate(env['ODOO_DB'],env['ODOO_LOGIN'],env['ODOO_API_KEY'],{})
models=xmlrpc.client.ServerProxy(env['ODOO_URL']+'/xmlrpc/2/object')
def kw(m,meth,args,k=None,tries=4):
    for t in range(tries):
        try: return models.execute_kw(env['ODOO_DB'],uid,env['ODOO_API_KEY'],m,meth,args,k or {})
        except (xmlrpc.client.Fault,xmlrpc.client.ProtocolError) as e:
            s=str(e)
            if 'cannot marshal None' in s: return None
            if ('Access Denied' in s or '503' in s or '404' in s) and t<tries-1: time.sleep(4*(t+1)); continue
            raise
try: ST=json.load(open(P+'jofotara_drain_state.json'))
except Exception: ST={'done':{},'errors':{},'pm':{}}
log=open(P+'jofotara_drain.log','a',buffering=1)
# payment method line per company (from previously sent invoice, else any manual inbound)
def pm_for(co):
    key=str(co)
    if key in ST['pm']: return ST['pm'][key]
    E={'context':{'allowed_company_ids':[co]}}
    s=kw('account.move','search_read',[[['company_id','=',co],['l10n_jo_edi_state','=','sent'],['preferred_payment_method_line_id','!=',False]],['preferred_payment_method_line_id']],{'context':E['context'],'limit':1})
    if s: pm=s[0]['preferred_payment_method_line_id'][0]
    else:
        ls=kw('account.payment.method.line','search_read',[[['company_id','=',co],['payment_type','=','inbound']],['id','name']],{'context':E['context'],'limit':1})
        pm=ls[0]['id'] if ls else None
    ST['pm'][key]=pm; return pm
sent=err=0
for co in [1,2,3,4]:
    E={'context':{'allowed_company_ids':[co],'company_id':co}}
    ids=kw('account.move','search',[[['company_id','=',co],['state','=','posted'],['l10n_jo_edi_state','=','to_send']]],{'context':E['context'],'order':'invoice_date desc, id desc'})
    ids=[i for i in ids if str(i) not in ST['done'] and str(i) not in ST['errors']]
    if not ids: continue
    pm=pm_for(co)
    for iid in ids:
        if time.time()-T0>BUDGET: break
        try:
            mv=kw('account.move','read',[[iid],['name','preferred_payment_method_line_id']],E)[0]
            if not mv['preferred_payment_method_line_id'] and pm:
                kw('account.move','write',[[iid],{'preferred_payment_method_line_id':pm}],E)
            ctx={'context':{**E['context'],'active_model':'account.move','active_ids':[iid]}}
            try:
                w=kw('account.move.send.wizard','create',[{}],ctx)
                if not isinstance(w,int):
                    w=kw('account.move.send.wizard','search',[[]],{'context':ctx['context'],'order':'id desc','limit':1})[0]
            except xmlrpc.client.Fault:
                w=kw('account.move.send.wizard','search',[[]],{'context':ctx['context'],'order':'id desc','limit':1})[0]
            try: kw('account.move.send.wizard','write',[[w],{'extra_edis':['jo_edi'],'sending_methods':['manual']}],ctx)
            except Exception: pass
            try: kw('account.move.send.wizard','action_send_and_print',[[w]],ctx,tries=1)
            except xmlrpc.client.Fault as e:
                if 'cannot marshal None' not in str(e):
                    ST['errors'][str(iid)]=str(e)[-160:]; log.write(f"co{co} {mv['name']}: WIZERR {str(e)[-120:]}\n"); err+=1; continue
            st=kw('account.move','read',[[iid],['l10n_jo_edi_state','l10n_jo_edi_error']],E)[0]
            if st['l10n_jo_edi_state']=='sent':
                ST['done'][str(iid)]=1; sent+=1
                log.write(f"co{co} {mv['name']}: SENT\n")
            else:
                ST['errors'][str(iid)]=str(st.get('l10n_jo_edi_error'))[:160]
                log.write(f"co{co} {mv['name']}: {st['l10n_jo_edi_state']} | {str(st.get('l10n_jo_edi_error'))[:120]}\n"); err+=1
        except Exception as e:
            ST['errors'][str(iid)]=str(e)[-160:]; log.write(f"co{co} id{iid}: EXC {str(e)[-120:]}\n"); err+=1
        if sent%25==0: json.dump(ST,open(P+'jofotara_drain_state.json','w'))
        time.sleep(0.3)
    if time.time()-T0>BUDGET: break
json.dump(ST,open(P+'jofotara_drain_state.json','w'))
log.write(f"ROUND DONE sent={sent} err={err} total_done={len(ST['done'])} total_err={len(ST['errors'])}\n")
print(f"ROUND: sent={sent} err={err} | TOTAL done={len(ST['done'])} err={len(ST['errors'])}")
