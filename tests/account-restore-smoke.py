"""Restore roundtrip with fictitious local data, never production."""
import json,secrets,urllib.request,urllib.error
from local_auth import database,session
owner='restore-'+secrets.token_hex(8);email=owner+'@example.test'
with database() as db:db.execute('INSERT INTO accounts(owner_id,display_name,skills,created_at) VALUES (?,?,?,?)',(owner,'Original','Go','test'))
cookie=session(owner);BASE='http://localhost:3001'
job={'id':'source-one','revision':4,'company':'Test','title':'Engineer','location':'','salary':'','url':'https://example.test','description':'Go','skills':['Go'],'notes':'Тест','interviewDate':'','nextActionDate':'','nextAction':'','stage':'applied','createdAt':'2026-09-01T00:00:00Z','updatedAt':'2026-09-02T00:00:00Z','history':[{'at':'2026-09-02T00:00:00Z','stage':'applied','action':'Отклик'}]}
backup={'format':'joblens-account-export','version':1,'profile':{'email':email,'displayName':'Restored','skills':'Go, SQL'},'jobs':[job]}
def req(path,body=None,token=cookie,origin=BASE):
 r=urllib.request.Request(BASE+path,method='POST' if body is not None else 'GET',data=json.dumps(body).encode() if body is not None else None,headers={'Cookie':token,'Origin':origin,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(r) as s:return s.status,json.load(s)
 except urllib.error.HTTPError as s:return s.code,json.load(s)
try:
 assert req('/api/account/restore',backup,token='')[0]==401
 assert req('/api/account/restore',backup,origin='https://evil.test')[0]==403
 bad={**backup,'profile':{**backup['profile'],'email':'other@example.test'}}
 assert req('/api/account/restore',bad)[0]==400
 status,result=req('/api/account/restore',backup);assert status==200,(status,result)
 assert result['imported']==1
 assert req('/api/account/restore',backup)[1]['imported']==0
 status,export=req('/api/account/export');assert status==200
 assert export['profile']['displayName']=='Restored' and len(export['jobs'])==1
 assert export['jobs'][0]['history']==job['history']
 assert req('/api/account/restore',export)[1]['imported']==0
 with database() as db:db.execute('DELETE FROM jobs WHERE owner_id=?',(owner,))
 assert req('/api/account/restore',export)[1]['imported']==1
 assert req('/api/health')[1]['status']=='ok'
 print('PASS: restore validation, owner binding, repeat import, full history roundtrip, health')
finally:
 with database() as db:
  for table in ['jobs','auth_sessions','accounts','email_identities']:db.execute('DELETE FROM '+table+' WHERE owner_id=?',(owner,))
