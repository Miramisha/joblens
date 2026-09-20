"""Local built-Worker test only; fake credentials, no requests are sent to hh.ru.
Use the isolated .wrangler/hh-test-state database described in docs/HH_SETUP.md.
"""
from local_auth import session, database
import json
import urllib.request
import urllib.error
import urllib.parse
import uuid
BASE='http://localhost:3001'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl): return None
opener=urllib.request.build_opener(NoRedirect)
owner='test-'+uuid.uuid4().hex
other=owner+'-other'
with database() as db:
    for name in [owner,other]:
        db.execute('INSERT INTO accounts(owner_id,display_name,created_at) VALUES (?,?,?)',(name,name,'test'))
sessions={owner:session(owner),other:session(other)}
def req(path,method='GET',data=None,user=owner,origin=BASE,cookie=None):
    headers={}
    if user:headers.update({'Cookie':sessions[user]})
    if origin:headers['Origin']=origin
    if cookie:headers['Cookie']=headers.get('Cookie','')+'; '+cookie
    if data is not None:headers['Content-Type']='application/json'
    request=urllib.request.Request(BASE+path,headers=headers,method=method,data=json.dumps(data).encode() if data is not None else None)
    try:
        with opener.open(request) as response:return response.status,response.headers,response.read().decode()
    except urllib.error.HTTPError as response:return response.code,response.headers,response.read().decode()
assert req('/api/account','POST',{'displayName':'Test'},user=None)[0]==401
assert req('/api/account','POST',{'displayName':'Test'},origin='https://other.example')[0]==403
result=req('/api/account','POST',{'displayName':''});assert result[0]==400,(result[0],result[2])
assert req('/api/account','POST',{'displayName':'x'*3000})[0]==400
assert req('/api/account','POST',{'displayName':owner})[0]==200
assert req('/api/account','POST',{'displayName':other},user=other)[0]==200
assert owner in req('/account')[2] and other not in req('/account')[2]
assert req('/api/hh/connect','POST',user=None)[0]==401
assert req('/api/hh/connect','POST',origin='https://other.example')[0]==403
assert req('/api/hh/connect','POST')[0]==410
assert req('/api/hh/disconnect','POST',origin='https://other.example')[0]==403
assert req('/api/hh/disconnect','POST')[0]==303
assert req('/api/hh/vacancies?q=frontend',user=None)[0]==401
assert req('/api/hh/vacancies?q=x')[0]==400
assert req('/api/hh/vacancies?url=https%3A%2F%2Flocalhost%2Fvacancy%2F1')[0]==400
assert req('/api/hh/vacancies?q=frontend&page=-1')[0]==400
print('PASS: profile, ownership, CSRF, retired OAuth, disconnect, vacancy query validation and SSRF rejection')

assert req('/api/account','POST',{'displayName':owner,'skills':'React, TypeScript, React'})[0]==200
assert 'React, TypeScript' in req('/account')[2]
assert 'React, TypeScript' not in req('/account',user=other)[2]
assert req('/api/account','POST',{'displayName':owner})[0]==200
with database() as db:
    assert db.execute('SELECT skills FROM accounts WHERE owner_id=?',(owner,)).fetchone()[0]=='React, TypeScript'
assert req('/api/account','POST',{'displayName':owner,'skills':[]})[0]==400
assert req('/api/account','POST',{'displayName':owner,'skills':'x'*1801})[0]==400
assert req('/api/account','POST',{'displayName':owner,'skills':''})[0]==200
with database() as db:
    assert db.execute('SELECT skills FROM accounts WHERE owner_id=?',(owner,)).fetchone()[0]==''
print('PASS: profile skills persistence, ownership, validation, clearing and name-only compatibility')
