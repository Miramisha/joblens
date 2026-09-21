"""Local isolated DB: export ownership, complete history, credential exclusion."""
import json, secrets, urllib.request, urllib.error
from local_auth import database, session
BASE='http://localhost:3001/api/account/export'
a='export-'+secrets.token_hex(8);b='other-'+secrets.token_hex(8)
history=[{'at':'2026-09-01','stage':'saved','action':'Добавлена'},{'at':'2026-09-02','stage':'applied','action':'Отклик'}]
with database() as db:
    for owner in [a,b]:
        db.execute('INSERT INTO accounts(owner_id,display_name,skills,created_at) VALUES (?,?,?,?)',(owner,owner,'React, Go','test'))
        db.execute('INSERT INTO jobs VALUES (?,?,?,?,?)',(owner,owner,json.dumps({'title':owner,'notes':'Заметка','history':history}),1,'test'))
    db.execute('INSERT INTO hh_connections VALUES (?,?,?,?,?,?)',(a,a,'HH profile','DO-NOT-EXPORT-SECRET',9999999999,'test'))
cookie=session(a)
def request(cookie=''):
    req=urllib.request.Request(BASE+'?ownerId='+b,headers={'Cookie':cookie})
    try:
        with urllib.request.urlopen(req) as r:return r.status,r.headers,r.read().decode()
    except urllib.error.HTTPError as r:return r.code,r.headers,r.read().decode()
try:
    assert request()[0]==401
    status,headers,raw=request(cookie);assert status==200,(status,raw)
    data=json.loads(raw)
    assert data['format']=='joblens-account-export' and data['version']==1
    assert data['profile']['email']==a+'@example.test'
    assert data['profile']['skills']=='React, Go'
    assert len(data['jobs'])==1 and data['jobs'][0]['title']==a
    assert data['jobs'][0]['history']==history
    assert b not in raw and 'DO-NOT-EXPORT-SECRET' not in raw and cookie.split('=')[1] not in raw
    assert set(data['connections'][0])=={'provider','userId','displayName','connectedAt'}
    assert 'attachment;' in headers['Content-Disposition'] and 'no-store' in headers['Cache-Control']
    with database() as db:db.execute('DELETE FROM jobs WHERE owner_id=?',(a,))
    assert json.loads(request(cookie)[2])['jobs']==[]
    print('PASS: export authentication, owner isolation, profile/history fidelity, no credentials, empty account, download headers')
finally:
    with database() as db:
        for owner in [a,b]:
            for table in ['jobs','hh_connections','auth_sessions','accounts','email_identities']:
                db.execute('DELETE FROM '+table+' WHERE owner_id=?',(owner,))
