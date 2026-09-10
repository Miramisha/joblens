"""Local built-Worker test only; fake credentials, no requests are sent to hh.ru.
Use the isolated .wrangler/hh-test-state database described in docs/HH_SETUP.md.
"""
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
def req(path,method='GET',data=None,user=owner,origin=BASE,cookie=None):
    headers={}
    if user:headers.update({'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'})
    if origin:headers['Origin']=origin
    if cookie:headers['Cookie']=cookie
    if data is not None:headers['Content-Type']='application/json'
    request=urllib.request.Request(BASE+path,headers=headers,method=method,data=json.dumps(data).encode() if data is not None else None)
    try:
        with opener.open(request) as response:return response.status,response.headers,response.read().decode()
    except urllib.error.HTTPError as response:return response.code,response.headers,response.read().decode()
def connect():
    status,headers,_=req('/api/hh/connect','POST');assert status==303
    url=urllib.parse.urlparse(headers['Location']);assert url.netloc=='hh.ru'
    query=urllib.parse.parse_qs(url.query);assert query['code_challenge_method']==['S256']
    assert 'client_secret' not in query
    return query['state'][0],headers['Set-Cookie'].split(';')[0]
def callback(state,cookie,user=owner):
    status,headers,_=req('/api/hh/callback?'+urllib.parse.urlencode({'state':state,'error':'access_denied'}),user=user,cookie=cookie)
    assert status==303
    return urllib.parse.parse_qs(urllib.parse.urlparse(headers['Location']).query)['hh'][0]
assert req('/api/account','POST',{'displayName':'Test'},user=None)[0]==401
assert req('/api/account','POST',{'displayName':'Test'},origin='https://other.example')[0]==403
assert req('/api/account','POST',{'displayName':''})[0]==400
assert req('/api/account','POST',{'displayName':'x'*3000})[0]==400
assert 'account_required' in req('/api/hh/connect','POST')[1]['Location']
assert req('/api/account','POST',{'displayName':owner})[0]==200
assert req('/api/account','POST',{'displayName':other},user=other)[0]==200
assert owner in req('/account')[2] and other not in req('/account')[2]
state,cookie=connect()
assert callback(state,cookie,user=other)=='invalid_state'
assert callback(state,'joblens_hh_state=wrong')=='invalid_state'
assert callback(state,cookie)=='denied'
assert callback(state,cookie)=='invalid_state'
state,cookie=connect()
assert req('/api/hh/disconnect','POST',origin='https://other.example')[0]==403
assert req('/api/hh/disconnect','POST')[0]==303
assert callback(state,cookie)=='invalid_state'
old,old_cookie=connect();new,new_cookie=connect()
assert callback(old,old_cookie)=='invalid_state'
assert callback(new,new_cookie)=='denied'
print('PASS: account creation, owner isolation, CSRF, PKCE redirect, cookie binding, cancellation, replay, restart and disconnect invalidation')
