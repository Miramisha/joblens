"""Isolated LOCAL Worker only. Uses fictitious expired and active records."""
import json, time, secrets, urllib.request, urllib.error
from local_auth import database
BASE='http://localhost:3001/api/maintenance/cleanup'
KEY='B'*43
prefix='cleanup-'+secrets.token_hex(8)
now=int(time.time())
with database() as db:
    for tag,expires in [('expired',now-1),('active',now+3600)]:
        identifier=prefix+tag
        db.execute('INSERT INTO email_challenges VALUES (?,?,?,?,?,?,?)',(identifier+'@example.test',identifier,'fake',expires,now,0,0))
        db.execute('INSERT INTO auth_sessions VALUES (?,?,?)',(identifier,identifier,expires))
        db.execute('INSERT INTO auth_limits VALUES (?,?,?)',(identifier,1,expires))
        db.execute('INSERT INTO hh_oauth_states VALUES (?,?,?,?)',(identifier,identifier,'fake',expires))
def request(key=None,method='POST'):
    req=urllib.request.Request(BASE,method=method,headers={'Authorization':'Bearer '+key} if key else {})
    try:
        with urllib.request.urlopen(req) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as r:return r.code,None
assert request()[0]==401
assert request('C'*43)[0]==401
assert request(KEY,'GET')[0]==405
assert request(KEY)[0]==200
with database() as db:
    for table,column in [('email_challenges','challenge_hash'),('auth_sessions','token_hash'),('auth_limits','bucket'),('hh_oauth_states','owner_id')]:
        for tag,count in [('expired',0),('active',1)]:
            assert db.execute('SELECT count(*) FROM '+table+' WHERE '+column+'=?',(prefix+tag,)).fetchone()[0]==count,(table,tag)
        db.execute('DELETE FROM '+table+' WHERE '+column+'=?',(prefix+'active',))
status,data=request(KEY);assert status==200
assert all(count==0 for count in data['deleted'].values()),data
print('PASS: cleanup authorization, POST-only, expired rows removed, active rows retained, repeated call')
