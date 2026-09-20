"""Fixtures exclusively for the isolated LOCAL .wrangler/hh-test-state database.
Never imported by application code; no production authentication bypass exists.
"""
import base64
import hashlib
import hmac
import secrets
import sqlite3
import time
from pathlib import Path
TEST_SECRET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
def digest(value):
    return base64.urlsafe_b64encode(hashlib.sha256(value.encode()).digest()).decode().rstrip('=')
def database():
    files=list((Path(__file__).resolve().parents[1]/'.wrangler/hh-test-state/v3/d1').rglob('*.sqlite'))
    files=[f for f in files if f.name!='metadata.sqlite']
    assert len(files)==1, 'Initialize the isolated test DB first'
    return sqlite3.connect(files[0],timeout=10)
def session(owner, expires=None):
    token=secrets.token_urlsafe(32)
    with database() as db:
        db.execute('INSERT OR IGNORE INTO email_identities VALUES (?,?,?)',(owner+'@example.test',owner,int(time.time())))
        db.execute('INSERT INTO auth_sessions VALUES (?,?,?)',(digest(token),owner,expires or int(time.time())+3600))
    return 'joblens_session='+token

def challenge(email=None, code='123456', expired=False, attempts=0):
    email=email or secrets.token_hex(12)+'@example.test'
    token=secrets.token_urlsafe(32); hashed=digest(token)
    signature=hmac.new(TEST_SECRET.encode(),(hashed+':'+code).encode(),hashlib.sha256).hexdigest()
    with database() as db:
        db.execute('INSERT OR REPLACE INTO email_challenges VALUES (?,?,?,?,?,?,0)',(email,hashed,signature,int(time.time())+(-1 if expired else 300),int(time.time()),attempts))
    return 'joblens_challenge='+token,email
