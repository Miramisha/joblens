"""Complete account journey against LOCAL fixtures, never real email or production."""
import json, urllib.request, urllib.error
from local_auth import challenge
BASE='http://localhost:3001'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None
opener=urllib.request.build_opener(NoRedirect)
def request(path,method='GET',data=None,cookie=''):
    req=urllib.request.Request(BASE+path,method=method,headers={'Origin':BASE,'Cookie':cookie,'Content-Type':'application/json'},data=json.dumps(data).encode() if data is not None else None)
    try:response=opener.open(req,timeout=15)
    except urllib.error.HTTPError as error:response=error
    with response:
        raw=response.read().decode()
        try:body=json.loads(raw)
        except ValueError:body=raw
        return response.code,response.headers,body

def login():
    challenge_cookie,email=challenge()
    status,headers,body=request('/api/auth/verify-code','POST',{'code':'123456'},challenge_cookie)
    assert status==200,(status,body)
    cookie=next(value.split(';')[0] for value in headers.get_all('Set-Cookie') if value.startswith('joblens_session='))
    # The used code cannot establish another session.
    assert request('/api/auth/verify-code','POST',{'code':'123456'},challenge_cookie)[0]==400
    return cookie,email
cookie,email=login()
assert request('/api/account','POST',{'displayName':'Journey Owner','skills':'React, TypeScript'},cookie)[0]==200
job_input={'company':'Lifecycle Fixture','title':'Frontend','stage':'saved','location':'Remote','salary':'','url':'','description':'React role','skills':['React'],'notes':'Private journey note','interviewDate':''}
status,_,created=request('/api/jobs','POST',job_input,cookie);assert status==201,(status,created)
job=created['job']
status,_,changed=request('/api/jobs','PUT',{**job,'stage':'applied'},cookie);assert status==200
job=changed['job']
assert request('/api/auth/logout','POST',{},cookie)[0]==303
assert request('/api/jobs',cookie=cookie)[0]==401
cookie,email=login()
status,_,loaded=request('/api/jobs',cookie=cookie);assert status==200
assert next(item for item in loaded['jobs'] if item['id']==job['id'])['notes']=='Private journey note'
status,_,backup=request('/api/account/export',cookie=cookie);assert status==200
assert backup['profile']['email']==email and backup['profile']['displayName']=='Journey Owner'
assert request('/api/jobs','DELETE',job,cookie)[0]==200
status,_,restored=request('/api/account/restore','POST',backup,cookie);assert status==200,(status,restored)
assert restored['imported']==1
status,_,roundtrip=request('/api/account/export',cookie=cookie);assert status==200
copy=next(item for item in roundtrip['jobs'] if item['company']=='Lifecycle Fixture')
assert copy['notes']==job['notes'] and copy['history']==job['history'] and copy['stage']=='applied'
assert request('/api/account/restore','POST',backup,cookie)[2]['imported']==0
assert request('/api/jobs','DELETE',copy,cookie)[0]==200
assert request('/api/auth/logout','POST',{},cookie)[0]==303
assert request('/api/account/export',cookie=cookie)[0]==401
print('PASS: code login, profile, job, logout, re-login persistence, export, delete, restore, history, replay and logout isolation')
