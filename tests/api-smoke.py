"""Run against the local Worker using the isolated test database."""
from local_auth import session, database
import json
import urllib.request
import urllib.error
BASE='http://localhost:3001'
with database() as db:
    for owner in ['joblens-test-a','joblens-test-b']:
        db.execute('INSERT OR IGNORE INTO accounts(owner_id,display_name,created_at) VALUES (?,?,?)',(owner,owner,'test'))
sessions={owner:session(owner) for owner in ['joblens-test-a','joblens-test-b']}
def request(method, payload=None, owner='joblens-test-a', origin=BASE):
    headers={'Content-Type':'application/json'}
    if owner: headers.update({'Cookie':sessions[owner]})
    if origin: headers['Origin']=origin
    req=urllib.request.Request(BASE+'/api/jobs',data=json.dumps(payload).encode() if payload is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req) as res:return res.status,json.load(res)
    except urllib.error.HTTPError as res:
        raw=res.read().decode()
        try: data=json.loads(raw)
        except json.JSONDecodeError: data={'error':raw}
        return res.code,data
input={'company':'Smoke Test','title':'Frontend','stage':'saved','location':'','salary':'','url':'','description':'','skills':['React'],'notes':'','interviewDate':''}
assert request('GET',owner=None)[0]==401
assert request('POST',input,origin='https://untrusted.example')[0]==403
assert request('POST',{**input,'url':'javascript:alert(1)'})[0]==400
status,data=request('POST',input);assert status==201,(status,data)
job=data['job']
try:
    assert any(j['id']==job['id'] for j in request('GET')[1]['jobs'])
    assert all(j['id']!=job['id'] for j in request('GET',owner='joblens-test-b')[1]['jobs'])
    assert request('PUT',job,owner='joblens-test-b')[0]==404
    assert request('DELETE',job,owner='joblens-test-b')[0]==409
    status,data=request('PUT',{**job,'stage':'interview','notes':'Interview booked'})
    assert status==200,(status,data)
    updated=data['job'];assert updated['revision']==2 and len(updated['history'])==2
    assert request('PUT',job)[0]==409
    assert request('DELETE',job)[0]==409
    assert request('DELETE',updated)[0]==200
    assert all(j['id']!=job['id'] for j in request('GET')[1]['jobs'])
finally:
    for j in request('GET')[1]['jobs']:
        if j['id']==job['id']:request('DELETE',j)
print('PASS: auth, origin, validation, durable CRUD, ownership, history, concurrent updates, cleanup')
