import xmlrpc.client, json
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
def kw(m,meth,args,k=None): return models.execute_kw(db,uid,key,m,meth,args,k or {})
BK=json.load(open(P+'jard_backup_full.json')); stor=json.load(open(P+'storable_map.json')); kits=set(json.load(open(P+'kit_products.json')))
log=open(P+'restore_fp2.log','a',buffering=1)
for bn,b in BK.items():
    co=b['company']
    ctxA={'context':{'allowed_company_ids':[co]}}
    ctxB={'context':{'allowed_company_ids':[co],'inventory_mode':True}}
    fp=[q for q in b['quants'] if '[FP]' in q['product'][1]]
    ids=[q['id'] for q in fp]; cur={}
    for i in range(0,len(ids),400):
        for c in kw('stock.quant','read',[ids[i:i+400],['quantity']],ctxB): cur[c['id']]=c['quantity']
    todo=[q for q in fp if abs(cur.get(q['id'],0.0))<1e-9 and abs(q['qty'])>1e-9]
    if not todo:
        log.write(f"{bn}: nothing to do\n"); continue
    S=[q for q in todo if stor.get(str(q['product'][0])) and q['product'][0] not in kits]
    O=[q for q in todo if not (stor.get(str(q['product'][0])) and q['product'][0] not in kits)]
    log.write(f"{bn}: todo={len(todo)} storable={len(S)} other={len(O)}\n")
    # storable: individual writes then batched apply
    sid=[]
    for q in S:
        try:
            kw('stock.quant','write',[[q['id']],{'inventory_quantity':q['qty'],'inventory_quantity_set':True}],ctxA); sid.append(q['id'])
        except xmlrpc.client.Fault as e: log.write(f"  wfail {q['id']} {str(e)[:80]}\n")
    for i in range(0,len(sid),50):
        try: kw('stock.quant','action_apply_inventory',[sid[i:i+50]],ctxA)
        except xmlrpc.client.Fault as e:
            if 'cannot marshal None' in str(e): continue
            for x in sid[i:i+50]:
                try: kw('stock.quant','action_apply_inventory',[[x]],ctxA)
                except xmlrpc.client.Fault as e2:
                    if 'cannot marshal None' not in str(e2): log.write(f"  afail {x}\n")
    ok=0
    for q in O:
        try: kw('stock.quant','write',[[q['id']],{'quantity':q['qty']}],ctxB); ok+=1
        except xmlrpc.client.Fault as e: log.write(f"  ofail {q['id']}\n")
    log.write(f"{bn}: DONE storable={len(sid)} other={ok}\n")
log.write("ALL DONE\n"); log.close()
