import xmlrpc.client, json, time
P='/tmp/claude-0/-home-user-almond/ba59e94f-62c6-5206-8db2-95dabac525e0/scratchpad/'
env={}
for ln in open(P+'.odoo_env'):
    ln=ln.strip()
    if not ln or ln.startswith('#'): continue
    ln=ln.replace('export ','',1)
    k,v=ln.split('=',1); env[k]=v.strip().strip('"').strip("'")
url=env['ODOO_URL']; db=env['ODOO_DB']; login=env['ODOO_LOGIN']; key=env['ODOO_API_KEY']
uid=xmlrpc.client.ServerProxy(url+'/xmlrpc/2/common').authenticate(db,login,key,{})
models=xmlrpc.client.ServerProxy(url+'/xmlrpc/2/object')
def kw(m,meth,args,k=None,tries=5):
    for t in range(tries):
        try: return models.execute_kw(db,uid,key,m,meth,args,k or {})
        except (xmlrpc.client.Fault,xmlrpc.client.ProtocolError) as e:
            if 'cannot marshal None' in str(e): return None
            if t<tries-1: time.sleep(3*(t+1)); continue
            raise
E={'context':{'allowed_company_ids':[1],'company_id':1}}
CUT='2026-07-31'
chunks=json.load(open(P+'rescue_italian_chunks.json'))
try: state=json.load(open(P+'rescue_italian_state.json'))
except Exception: state={'done':[],'invoices':[]}
log=open(P+'rescue_italian.log','a',buffering=1)
DRAFT=[['company_id','=',1],['move_type','=','out_invoice'],['state','=','draft'],['partner_id','=',8]]
for idx,ch in enumerate(chunks):
    if idx in state['done']: continue
    # adopt-or-create
    dom=DRAFT+[['line_ids.sale_line_ids.order_id','in',ch]]
    ex=kw('account.move','search',[dom],E)
    if ex: inv=ex
    else:
        wctx={'context':{'allowed_company_ids':[1],'company_id':1,'active_model':'sale.order','active_ids':ch}}
        before=set(kw('account.move','search',[DRAFT],E))
        w=kw('sale.advance.payment.inv','create',[{'advance_payment_method':'delivered'}],wctx)
        kw('sale.advance.payment.inv','create_invoices',[[w]],wctx,tries=1)
        after=kw('account.move','search',[DRAFT],E)
        inv=[i for i in after if i not in before]
    if not inv:
        log.write(f'chunk{idx}: NO INVOICE\n'); continue
    kw('account.move','write',[inv,{'invoice_date':CUT,'date':CUT}],E)
    for i in inv:
        t0=time.time()
        kw('account.move','action_post',[[i]],E,tries=1)
        st=kw('account.move','read',[[i],['name','state','amount_total']],E)[0]
        log.write(f"chunk{idx} inv{i}: {st['name']} {st['state']} {st['amount_total']:.2f} ({time.time()-t0:.0f}s)\n")
        state['invoices'].append(st)
    state['done'].append(idx)
    json.dump(state,open(P+'rescue_italian_state.json','w'),ensure_ascii=False,default=str)
log.write('ALL DONE total=%.2f\n'%sum(x['amount_total'] for x in state['invoices']))
log.close()
