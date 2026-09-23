"""Local-only roundtrip of encrypted scheduled owner backup, never production."""
import json, os, subprocess, tempfile, time, urllib.request, urllib.error
from pathlib import Path
from local_auth import database
BASE='http://localhost:3001'
def request(path, key=None, method='POST', data=None, cookie=None):
    headers={}
    if key: headers['Authorization']='Bearer '+key
    if cookie: headers.update({'Cookie':cookie,'Origin':BASE,'Content-Type':'application/json'})
    req=urllib.request.Request(BASE+path,method=method,headers=headers,data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as r:return r.code,None
assert request('/api/maintenance/backup')[0]==401
assert request('/api/maintenance/backup','B'*43)[0]==401
assert request('/api/maintenance/backup','D'*43,'GET')[0]==405
email=os.environ['TEST_LOGIN_EMAIL']
with database() as db:
    identity=db.execute('SELECT owner_id FROM email_identities WHERE email=?',(email,)).fetchone()
    owner=identity[0] if identity else 'backup-owner'
    db.execute('INSERT OR IGNORE INTO email_identities VALUES (?,?,?)',(email,owner,int(time.time())))
    db.execute('INSERT OR IGNORE INTO accounts VALUES (?,?,?,?,?)',(owner,'Backup Owner','TypeScript',None,'2026-01-01T00:00:00Z'))
# The real scheduled route must encrypt a snapshot above the former count/history caps.
fixture={'company':'Backup Fixture','title':'Engineer','location':'','salary':'','url':'','description':'','skills':[],'notes':'','interviewDate':'','nextActionDate':'','nextAction':'','stage':'saved','revision':1,'createdAt':'2026-01-01T00:00:00Z','updatedAt':'2026-01-01T00:00:00Z','history':[{'at':'2026-01-01T00:00:00Z','stage':'saved','action':'Created'}]}
with database() as db:
    for index in range(101):
        row={**fixture,'id':f'backup-regression-{index}'}
        if index==0:row['history']=fixture['history']*1001
        db.execute('INSERT INTO jobs(id,owner_id,payload,revision,updated_at) VALUES (?,?,?,1,?)',(row['id'],owner,json.dumps(row),row['updatedAt']))
status,envelope=request('/api/maintenance/backup','D'*43)
assert status==200,(status,envelope)
assert email not in json.dumps(envelope)
with tempfile.TemporaryDirectory() as folder:
    source=Path(folder)/'encrypted.json'; output=Path(folder)/'decrypted.json'
    source.write_text(json.dumps(envelope))
    subprocess.run(['node','scripts/decrypt-backup.mjs',str(source),os.environ['TEST_BACKUP_PRIVATE_KEY'],str(output)],check=True)
    data=json.loads(output.read_text())
    assert data['profile']['email']==email
    assert data['format']=='joblens-account-export'
    assert len(data['jobs'])>=101
    assert any(len(j['history'])==1001 for j in data['jobs'])
    assert all(field not in json.dumps(data) for field in ['token_hash','code_hash','encrypted_tokens'])
    # Test decryption -> actual restore API with the owner's isolated session.
    import secrets
    from local_auth import digest
    token=secrets.token_urlsafe(32)
    with database() as db:db.execute('INSERT INTO auth_sessions VALUES (?,?,?)',(digest(token),owner,int(time.time())+3600))
    assert request('/api/account/restore',data=data,cookie='joblens_session='+token)[0]==200
print('PASS: encrypted scheduled backup authorization, owner isolation, decryption and restore API')

with database() as db:
    db.execute("DELETE FROM jobs WHERE owner_id=? AND json_extract(payload,'$.company')='Backup Fixture'",(owner,))
