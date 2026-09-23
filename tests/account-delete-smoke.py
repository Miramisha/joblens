"""Deletion checks against the isolated LOCAL Worker only; fictitious accounts."""
import json, secrets, urllib.request, urllib.error
from local_auth import database, session, challenge, digest
BASE='http://localhost:3001'
a='delete-'+secrets.token_hex(8); b='keep-'+secrets.token_hex(8)
with database() as db:
    for owner in [a,b]:
        db.execute('INSERT INTO accounts(owner_id,display_name,created_at) VALUES (?,?,?)',(owner,owner,'test'))
        db.execute('INSERT INTO jobs VALUES (?,?,?,?,?)',(owner,owner,'{}',1,'test'))
cookie=session(a); second=session(a); other=session(b)
challenge(a+'@example.test')
with database() as db:
    db.execute('INSERT INTO hh_oauth_states VALUES (?,?,?,?)',(a,a,'fake',9999999999))
    db.execute('INSERT INTO hh_connections VALUES (?,?,?,?,?,?)',(a,a,'test','fake',9999999999,'test'))
    db.execute('INSERT INTO auth_limits VALUES (?,?,?)',('email:'+digest(a+'@example.test'),1,9999999999))
def request(cookie, email, origin=BASE):
    req=urllib.request.Request(BASE+'/api/account/delete',data=json.dumps({'email':email,'confirmation':'DELETE','ownerId':b}).encode(),headers={'Cookie':cookie,'Origin':origin,'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req) as r:return r.status,r.headers
    except urllib.error.HTTPError as r:
        if r.code >= 500: print('LOCAL HTTP FAILURE',r.code,r.read().decode(errors='replace')[:1200])
        return r.code,r.headers
assert request('',a+'@example.test')[0]==401
assert request(cookie,a+'@example.test','https://evil.test')[0]==403
status,_=request(cookie,b+'@example.test');assert status==400,status
status,headers=request(cookie,a+'@example.test');assert status==200,status
assert all('Max-Age=0' in c for c in headers.get_all('Set-Cookie'))
assert request(second,a+'@example.test')[0]==401
with database() as db:
    for table in ['accounts','jobs','hh_connections','hh_oauth_states','auth_sessions','email_identities']:
        assert db.execute('SELECT count(*) FROM '+table+' WHERE owner_id=?',(a,)).fetchone()[0]==0,table
    assert db.execute('SELECT count(*) FROM email_challenges WHERE email=?',(a+'@example.test',)).fetchone()[0]==0
    assert db.execute('SELECT count(*) FROM auth_limits WHERE bucket=?',('email:'+digest(a+'@example.test'),)).fetchone()[0]==0
    assert db.execute('SELECT count(*) FROM accounts WHERE owner_id=?',(b,)).fetchone()[0]==1
    assert db.execute('SELECT count(*) FROM jobs WHERE owner_id=?',(b,)).fetchone()[0]==1
assert request(other,b+'@example.test')[0]==200
print('PASS: account deletion, confirmation, origin, all sessions revoked, related records removed, other owner preserved')
