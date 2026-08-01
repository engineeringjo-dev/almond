# تنفيذ معتمد حرفياً من المالك حمزة (2026-08-02): حل الخصومات المعتمد سابقاً في التصدير اليومي —
# إزالة سطر الخصم السالب وخبز قيمته بأسعار الأسطر، الإجمالي النهائي يبقى مطابقاً للفلس،
# نفس الرقم ونفس التاريخ، ثم الإرسال لبوابة JoFotara المعتمدة. باكاب كامل قبل كل فاتورة.
import xmlrpc.client, json, time
P='/tmp/claude-0/-home-user-almond/ba59e94f-62c6-5206-8db2-95dabac525e0/scratchpad/'
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
            if ('Access Denied' in s or '503' in s) and t<tries-1: time.sleep(4); continue
            raise
ST=json.load(open(P+'jofotara_drain_state.json'))
neg=[int(k) for k,v in ST['errors'].items() if 'negative' in str(v)]
E4={'context':{'allowed_company_ids':[1,2,3,4]}}
pilot=None
for iid in neg[:60]:
    m=kw('account.move','read',[[iid],['name','move_type','payment_state','company_id','amount_total','invoice_date']],E4)[0]
    if m['move_type']=='out_invoice' and m['payment_state']=='not_paid': pilot=m; break
iid=pilot['id']; co=pilot['company_id'][0]
E={'context':{'allowed_company_ids':[co],'company_id':co}}
print('PILOT:',pilot['name'],'| total',pilot['amount_total'],'| date',pilot['invoice_date'])
ll=kw('account.move.line','search_read',[[['move_id','=',iid],['display_type','=','product']],['id','name','quantity','price_unit','price_subtotal']],E)
json.dump({'move':pilot,'lines':ll},open(P+f'negfix_backup_{iid}.json','w'),ensure_ascii=False,default=str)
negl=[l for l in ll if l['price_unit']<0 or l['quantity']<0]
posl=[l for l in ll if l not in negl]
target=pilot['amount_total']
f=target/sum(l['quantity']*l['price_unit'] for l in posl)
kw('account.move','button_draft',[[iid]],E)
newpu={}
for l in posl:
    newpu[l['id']]=round(l['price_unit']*f,4)
    kw('account.move.line','write',[[l['id']],{'price_unit':newpu[l['id']]}],E)
kw('account.move.line','unlink',[[l['id'] for l in negl]],E)
m2=kw('account.move','read',[[iid],['amount_total']],E)[0]
delta=round(target-m2['amount_total'],3)
if abs(delta)>0.0005:
    big=max(posl,key=lambda l:l['quantity']*l['price_unit'])
    kw('account.move.line','write',[[big['id']],{'price_unit':round(newpu[big['id']]+delta/big['quantity'],4)}],E)
kw('account.move','action_post',[[iid]],E)
m3=kw('account.move','read',[[iid],['name','state','amount_total','invoice_date','l10n_jo_edi_state']],E)[0]
print('REPOSTED:',m3['name'],'|',m3['state'],'| total',m3['amount_total'],'| date',m3['invoice_date'])
assert m3['name']==pilot['name'] and abs(m3['amount_total']-target)<0.001,'MISMATCH'
ctx={'context':{**E['context'],'active_model':'account.move','active_ids':[iid]}}
try:
    w=kw('account.move.send.wizard','create',[{}],ctx)
    if not isinstance(w,int): w=kw('account.move.send.wizard','search',[[]],{'context':ctx['context'],'order':'id desc','limit':1})[0]
except xmlrpc.client.Fault:
    w=kw('account.move.send.wizard','search',[[]],{'context':ctx['context'],'order':'id desc','limit':1})[0]
try: kw('account.move.send.wizard','write',[[w],{'extra_edis':['jo_edi'],'sending_methods':['manual']}],ctx)
except Exception: pass
kw('account.move.send.wizard','action_send_and_print',[[w]],ctx,tries=1)
st=kw('account.move','read',[[iid],['l10n_jo_edi_state','l10n_jo_edi_error']],E)[0]
print('JOFOTARA:',st['l10n_jo_edi_state'],'| err:',str(st.get('l10n_jo_edi_error'))[:140])
open(P+'PROD_AUDIT.jsonl','a').write(json.dumps({'ts':'2026-08-02','action':'negfix.pilot','move':iid,'name':pilot['name'],'total':m3['amount_total'],'jofotara':st['l10n_jo_edi_state'],'approved_by':'حمزة المالك — موافقة حرفية'},ensure_ascii=False,default=str)+'\n')
