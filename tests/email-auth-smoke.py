"""Local built Worker, isolated test DB, fake auth settings. Never sends emails."""
from concurrent.futures import ThreadPoolExecutor
import json
import time
import urllib.request
import urllib.error
from local_auth import challenge, database, session, digest
BASE='http://localhost:3001'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args): return None
opener=urllib.request.build_opener(NoRedirect)
def req(path, data=None, cookie='', origin=BASE, headers=None):
    h={'Origin':origin,'Cookie':cookie,**(headers or {})}
    if data is not None:h['Content-Type']='application/json'
    request=urllib.request.Request(BASE+path,headers=h,method='POST' if data is not None else 'GET',data=json.dumps(data).encode() if data is not None else None)
    try:
        with opener.open(request) as r:return r.status,r.headers,r.read().decode()
    except urllib.error.HTTPError as r:return r.code,r.headers,r.read().decode()
def verify(cookie,code='123456',**kwargs):return req('/api/auth/verify-code',{'code':code},cookie,**kwargs)
def login(cookie):
    status,headers,body=verify(cookie);assert status==200,(status,body)
    cookies=headers.get_all('Set-Cookie');assert any('HttpOnly' in c and 'SameSite=Lax' in c for c in cookies)
    return next(c.split(';')[0] for c in cookies if c.startswith('joblens_session='))
assert req('/api/jobs',headers={'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test'})[0]==401
assert req('/api/auth/send-code',{'email':'valid@example.test'},origin='https://evil.test')[0]==403
assert req('/api/auth/send-code',{'email':'invalid'})[0]==400
# Cooldown and hourly quotas reject before reaching the mail provider.
cooldown,email=challenge()
assert req('/api/auth/send-code',{'email':email})[0]==429
with database() as db:
    db.execute('INSERT OR REPLACE INTO auth_limits VALUES (?,?,?)',('email:'+digest(email),5,int(time.time())+3600))
assert req('/api/auth/send-code',{'email':email})[0]==429
with database() as db:db.execute('INSERT OR REPLACE INTO auth_limits VALUES (?,?,?)',('global',200,int(time.time())+3600))
assert req('/api/auth/send-code',{'email':'limit@example.test'})[0]==429
with database() as db:db.execute('DELETE FROM auth_limits WHERE bucket=?',('global',))
cookie,email=challenge()
assert verify(cookie,origin='https://evil.test')[0]==403
assert verify('')[0]==400
assert verify('joblens_challenge='+'a'*43)[0]==400
session_cookie=login(cookie)
with database() as db:assert db.execute("SELECT COUNT(*) FROM email_challenges WHERE email=?",(email,)).fetchone()[0]==0
assert verify(cookie)[0]==400
assert req('/api/jobs',cookie=session_cookie)[0]==200
assert email in req('/account',cookie=session_cookie)[2]
with database() as db:
    owner=db.execute('SELECT owner_id FROM email_identities WHERE email=?',(email,)).fetchone()[0]
    assert db.execute('SELECT COUNT(*) FROM accounts WHERE owner_id=?',(owner,)).fetchone()[0]==1
cookie,_=challenge(email)
second_session=login(cookie)
with database() as db:assert db.execute('SELECT owner_id FROM email_identities WHERE email=?',(email,)).fetchone()[0]==owner
assert req('/api/auth/logout',{},second_session,origin='https://evil.test')[0]==403
pending,_=challenge()
assert verify(pending,"999999")[0]==400
assert req('/api/auth/logout',{},second_session+'; '+pending)[0]==303
assert verify(pending)[0]==400
assert req('/api/jobs',cookie=second_session)[0]==401
assert req('/api/jobs',cookie=session(owner,expires=int(time.time())-10))[0]==401
cookie,expired_email=challenge(expired=True);assert verify(cookie)[0]==400
with database() as db:assert db.execute("SELECT COUNT(*) FROM email_challenges WHERE email=?",(expired_email,)).fetchone()[0]==0
cookie,_=challenge()
for _ in range(5):assert verify(cookie,'999999')[0]==400
assert verify(cookie)[0]==400
cookie,_=challenge()
with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(lambda _:verify(cookie)[0],range(2)))
assert sorted(statuses)==[200,400],statuses
# Previously revoked rows must never authenticate, even with the correct code.
revoked,email=challenge(attempts=1)
with database() as db:db.execute('UPDATE email_challenges SET consumed=1 WHERE email=?',(email,))
assert verify(revoked)[0]==400
# Resending invalidates the old browser challenge immediately.
old,email=challenge();new,_=challenge(email)
assert verify(old)[0]==400
assert verify(new)[0]==200
print('PASS: email activation, repeat login, origin, forged identity, cookie binding, expiry, attempts, replay, concurrent verification, resend invalidation, logout')
