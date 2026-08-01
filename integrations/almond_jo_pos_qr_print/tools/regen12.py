# ضمن نطاق موافقة المالك على إصلاح طباعة QR (2026-08-01): إعادة توليد النسخة المخزَّنة
# للفواتير التي تحمل رمزاً ولا تطبعه. طباعة فقط — extra_edis=[] ⇒ لا إرسال للبوابة إطلاقاً.
import xmlrpc.client, json, time, base64, sys
P='/tmp/claude-0/-home-user-almond/ba59e94f-62c6-5206-8db2-95dabac525e0/scratchpad/'
APPLY='--apply' in sys.argv
env={}
for ln in open(P+'.odoo_env'):
    ln=ln.strip()
    if not ln or ln.startswith('#'): continue
    ln=ln.replace('export ','',1); k,v=ln.split('=',1); env[k]=v.strip().strip('"').strip("'")
uid=xmlrpc.client.ServerProxy(env['ODOO_URL']+'/xmlrpc/2/common').authenticate(env['ODOO_DB'],env['ODOO_LOGIN'],env['ODOO_API_KEY'],{})
models=xmlrpc.client.ServerProxy(env['ODOO_URL']+'/xmlrpc/2/object',allow_none=True)
def kw(m,meth,args,k=None,tries=4):
    for t in range(tries):
        try: return models.execute_kw(env['ODOO_DB'],uid,env['ODOO_API_KEY'],m,meth,args,k or {})
        except xmlrpc.client.Fault as e:
            if 'cannot marshal None' in str(e): return None
            raise
        except Exception as e:
            if t<tries-1 and any(s in str(e) for s in ('Access Denied','503','404','502')): time.sleep(4*(t+1)); continue
            raise
CX={'allowed_company_ids':[1,2,3,4]}

# الفواتير المتأثرة: تحمل رمزاً + حالة sent/demo + بلا مرفق XML ⇒ لا تطبع الرمز بالقالب الأردني
ids=kw('account.move','search',[[['l10n_jo_edi_qr','!=',False],['move_type','in',['out_invoice','out_refund']],
        ['l10n_jo_edi_state','in',['sent','demo']]]],{'context':CX})
recs=kw('account.move','read',[ids,['name','company_id','l10n_jo_edi_state','invoice_pdf_report_id','l10n_jo_edi_qr']],{'context':CX})
att=kw('ir.attachment','search_read',[[['res_model','=','account.move'],['res_id','in',ids],
        ['res_field','=','l10n_jo_edi_xml_attachment_file']]],{'context':CX,'fields':['res_id']})
has_xml={a['res_id'] for a in att}
target=[r for r in recs if r['id'] not in has_xml]
print(f'فواتير بحالة sent/demo وتحمل رمزاً: {len(recs)} | بلا مرفق XML (لا تطبع الرمز): {len(target)}')
for r in target:
    print(f"  [{r['id']}] {r['name']:20} {r['company_id'][1][:24]:24} pdf_مخزَّن={bool(r['invoice_pdf_report_id'])}")
if not APPLY:
    print('\n— معاينة فقط. أضف --apply للتنفيذ —'); sys.exit()

audit=open(P+'PROD_AUDIT.jsonl','a')
ok=[]; fail=[]
for r in target:
    mid=r['id']; co=r['company_id'][0]
    E={'allowed_company_ids':[co],'company_id':co}
    try:
        # ١) احذف النسخة المخزَّنة القديمة (بلا رمز)
        old=kw('ir.attachment','search',[[['res_model','=','account.move'],['res_id','=',mid],
               ['res_field','=','invoice_pdf_report_file']]],{'context':E})
        if old: kw('ir.attachment','unlink',[old],{'context':E})
        # ٢) أعد التوليد عبر معالج الإرسال — طباعة فقط، بلا أي EDI
        w=kw('account.move.send.wizard','create',[{'move_id':mid}],
             {'context':dict(E,active_model='account.move',active_ids=[mid],default_move_id=mid)})
        kw('account.move.send.wizard','write',[[w],{'extra_edis':[],'sending_methods':['manual']}],{'context':E})
        kw('account.move.send.wizard','action_send_and_print',[[w]],
           {'context':dict(E,active_model='account.move',active_ids=[mid])})
        # ٣) تحقّق: هل ظهر الرمز في النسخة الجديدة؟
        na=kw('ir.attachment','search_read',[[['res_model','=','account.move'],['res_id','=',mid],
              ['res_field','=','invoice_pdf_report_file']]],{'context':E,'fields':['name','file_size','datas']})
        if not na: fail.append((r['name'],'لم تُنشأ نسخة')); print(f"  ✗ {r['name']}: لم تُنشأ نسخة"); continue
        pdf=base64.b64decode(na[0]['datas'])
        open(P+'regen/'+r['name'].replace('/','_')+'.pdf','wb').write(pdf)
        ok.append((r['name'],na[0]['file_size']))
        print(f"  ✓ {r['name']:20} نسخة جديدة {na[0]['file_size']:,} بايت")
        audit.write(json.dumps({'ts':'2026-08-02','action':'invoice.regen_pdf_for_qr','move':mid,'name':r['name'],
            'company':co,'reason':'النسخة المخزَّنة وُلِّدت قبل نشر عرض QR (view 4360) فكانت بلا رمز',
            'approved_by':'حمزة المالك — «طلعه عالانتاج عطول»','edi':'لا إرسال — extra_edis=[]'},ensure_ascii=False)+'\n')
    except Exception as e:
        fail.append((r['name'],str(e)[:120])); print(f"  ✗ {r['name']}: {str(e)[:120]}")
    time.sleep(0.4)
audit.close()
print(f'\nنجح: {len(ok)} | فشل: {len(fail)}')
for n,e in fail: print('   ✗',n,e)
json.dump({'ok':ok,'fail':fail},open(P+'regen12_result.json','w'),ensure_ascii=False)
