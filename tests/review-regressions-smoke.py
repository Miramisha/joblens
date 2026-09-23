"""Local-only regressions from the full review; fixtures are removed afterwards."""
import json,secrets,urllib.request,urllib.error
from local_auth import database,session
BASE='http://localhost:3001'
owner='review-'+secrets.token_hex(8)
email=owner+'@example.test'
with database() as db: db.execute('INSERT INTO accounts(owner_id,display_name,skills,created_at) VALUES (?,?,?,?)',(owner,'Test','','2026-01-01T00:00:00Z'))
cookie=session(owner)
def req(path,body=None,method=None):
 r=urllib.request.Request(BASE+path,method=method or ('POST' if body is not None else 'GET'),data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers={'Cookie':cookie,'Origin':BASE,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as response:return response.code,json.load(response)
try:
 # UTF-8 byte budget must accommodate the documented character limits.
 assert req('/api/account',{'displayName':'Тест','skills':'Я'*1800})[0]==200
 # Maximum accepted Unicode fields must remain editable after import.
 from csv import writer
 from io import StringIO
 large={'company':'Компания','title':'Разработчик','description':'界'*20000,'notes':'界'*10000,'skills':json.dumps([str(i)+'界'*58 for i in range(30)],ensure_ascii=False),'nextAction':'界'*500,'location':'界'*160,'salary':'界'*120,'url':'https://example.com/'+'界'*1900}
 output=StringIO(); csv_writer=writer(output,delimiter=';');csv_writer.writerow(large.keys());csv_writer.writerow(large.values())
 assert req('/api/jobs/import',{'csv':output.getvalue()})[1]['imported']==1
 imported=req('/api/jobs')[1]['jobs'][0]
 status,updated=req('/api/jobs',{**imported,'stage':'applied'},'PUT')
 assert status==200,(status,updated)
 assert updated['job']['description']==large['description']
 assert req('/api/jobs',{'id':updated['job']['id'],'revision':updated['job']['revision']},'DELETE')[0]==200
 csv='company;title\nExample;Engineer'
 assert req('/api/jobs/import',{'csv':csv})[1]['imported']==1
 original=req('/api/jobs')[1]['jobs'][0]
 assert req('/api/jobs',{**original,'title':'Different role'},'PUT')[0]==200
 assert req('/api/jobs/import',{'csv':csv})[1]['imported']==1
 assert req('/api/jobs/import',{'csv':csv})[1]['imported']==0
 # Two simultaneous imports must agree on current duplicate identity.
 from concurrent.futures import ThreadPoolExecutor
 with ThreadPoolExecutor(max_workers=2) as pool:
  results=list(pool.map(lambda _:req('/api/jobs/import',{'csv':'company;title\nConcurrent;Engineer'}),range(2)))
 assert all(r[0]==200 for r in results),results
 assert sum(r[1]['imported'] for r in results)==1,results
 # Export, restore, re-export, restore again, then import an older generation.
 snapshot=req('/api/account/export')[1]
 with database() as db:db.execute('DELETE FROM jobs WHERE owner_id=?',(owner,))
 assert req('/api/account/restore',snapshot)[1]['imported']==3
 newer=req('/api/account/export')[1]
 with database() as db:db.execute('DELETE FROM jobs WHERE owner_id=?',(owner,))
 assert req('/api/account/restore',newer)[1]['imported']==3
 assert req('/api/account/restore',snapshot)[1]['imported']==0
 assert len(req('/api/jobs')[1]['jobs'])==3
 # More than 100 jobs and 1000 history entries roundtrip intact.
 row=snapshot['jobs'][0]
 big={**snapshot,'jobs':[{**row,'id':f'bulk-{i}'} for i in range(101)]}
 big['jobs'][0]['history']=row['history']*1001
 assert req('/api/account/restore',big)[0]==200
 assert len(req('/api/jobs')[1]['jobs'])==104
 assert req('/api/account/restore',big)[1]['imported']==0
 # Storage rejection is atomic: profile and all rows remain unchanged.
 huge={**snapshot,'profile':{**snapshot['profile'],'displayName':'Must not apply'},'jobs':[{**row,'id':f'huge-{i}','history':[{'at':row['createdAt'],'stage':'saved','action':'x'*1000}]*850} for i in range(5)]}
 status,error=req('/api/account/restore',huge)
 assert status==413,(status,error)
 assert len(req('/api/jobs')[1]['jobs'])==104
 assert req('/api/account/export')[1]['profile']['displayName']!='Must not apply'
 print('PASS: UTF-8 profile, edited CSV reimport, concurrent import, generations, 101 jobs, 1001 events, atomic storage quota')
finally:
 with database() as db:
  for table in ['jobs','auth_sessions','accounts','email_identities']:db.execute('DELETE FROM '+table+' WHERE owner_id=?',(owner,))
