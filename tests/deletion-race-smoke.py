"""Delay request bodies while a parallel request deletes the isolated account."""
import http.client,json,secrets,threading,time,urllib.request,sqlite3
from local_auth import database,session
BASE='http://localhost:3001'
inputs=[('/api/account',{'displayName':'Late save','skills':'Go'}),('/api/jobs',{'company':'Late','title':'Late','stage':'saved','location':'','salary':'','url':'','description':'','skills':[],'notes':'','interviewDate':''}),('/api/jobs/import',{'csv':'company;title\nLate;Late'})]
for path,payload in inputs:
 owner='race-'+secrets.token_hex(8)
 with database() as db:db.execute('INSERT INTO accounts(owner_id,display_name,created_at) VALUES (?,?,?)',(owner,'Test','2026-01-01'))
 cookie=session(owner)
 data=json.dumps(payload).encode(); started=threading.Event(); release=threading.Event(); result=[]
 def late_save():
  try:
   connection=http.client.HTTPConnection('localhost',3001,timeout=10)
   connection.putrequest('POST',path)
   for k,v in {'Cookie':cookie,'Origin':BASE,'Content-Type':'application/json','Content-Length':str(len(data))}.items():connection.putheader(k,v)
   connection.endheaders(data[:1]);started.set()
   assert release.wait(5)
   connection.send(data[1:]);response=connection.getresponse();result.append(response.status);response.read();connection.close()
  except Exception as error:result.append(repr(error))
 thread=threading.Thread(target=late_save);thread.start()
 try:
  assert started.wait(5)
  # Let the server authenticate and begin waiting for the rest of the body.
  time.sleep(0.25)
  body=json.dumps({'email':owner+'@example.test','confirmation':'DELETE'}).encode()
  request=urllib.request.Request(BASE+'/api/account/delete',data=body,headers={'Cookie':cookie,'Origin':BASE,'Content-Type':'application/json'})
  with urllib.request.urlopen(request) as response:assert response.status==200
 finally:
  release.set();thread.join(10)
 assert result==[401],(path,result)
 with database() as db:
  assert db.execute('SELECT count(*) FROM accounts WHERE owner_id=?',(owner,)).fetchone()[0]==0
  assert db.execute('SELECT count(*) FROM jobs WHERE owner_id=?',(owner,)).fetchone()[0]==0
  try:db.execute('INSERT INTO jobs(id,owner_id,payload,revision,updated_at) VALUES (?,?,?,1,?)',(owner,owner,'{}','2026'))
  except sqlite3.IntegrityError as error:assert 'joblens_owner_deleted' in str(error)
  else:raise AssertionError('Database allowed an orphan job')
print('PASS: in-flight profile, job and CSV writes cannot survive account deletion; database rejects orphan jobs')
