"""Build first. Runs only the isolated localhost test Worker, never production."""
import os
import atexit
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
WRANGLER = str(ROOT / 'node_modules/.bin/wrangler')
env = {**os.environ, 'WRANGLER_SEND_METRICS': 'false', 'WRANGLER_WRITE_LOGS': 'false', 'CHOKIDAR_USEPOLLING': 'true', 'TEST_LOGIN_EMAIL': 'owner@example.test'}
# Refuse to run against another process accidentally occupying the test port.
with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1', 3001)) == 0:
        sys.exit('Port 3001 is occupied. Stop the test Worker before this suite.')
(ROOT / '.wrangler').mkdir(exist_ok=True)
state = tempfile.TemporaryDirectory(prefix='integration-', dir=ROOT / '.wrangler')
atexit.register(state.cleanup)
env['JOBLENS_TEST_STATE'] = state.name
for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
    subprocess.run([WRANGLER, 'd1', 'execute', 'DB', '--local', '--config', 'wrangler.local.json', '--persist-to', state.name, '--file', str(migration)], env=env, check=True, stdout=subprocess.DEVNULL)
# This runner is intended for a fresh isolated database (for example a CI checkout).
command = [WRANGLER, 'dev', '--config', 'dist/server/wrangler.json', '--port', '3001', '--persist-to', state.name]
for key, value in {'AUTH_SECRET': 'A'*43, 'RESEND_API_KEY': 'test-not-a-real-key', 'EMAIL_FROM': 'test@example.test', 'ALLOWED_LOGIN_EMAIL': 'owner@example.test', 'MAINTENANCE_SECRET': 'B'*43}.items():
    command += ['--var', key+':'+value]
with tempfile.TemporaryFile() as logs:
    process = subprocess.Popen(command, env=env, stdout=logs, stderr=subprocess.STDOUT)
    try:
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError('Test Worker exited before becoming ready')
            with socket.socket() as probe:
                if probe.connect_ex(('127.0.0.1', 3001)) == 0:
                    break
            time.sleep(0.5)
        else:
            raise RuntimeError('Test Worker did not become ready')
        for name in ['email-auth-smoke.py', 'account-export-smoke.py', 'account-restore-smoke.py', 'account-delete-smoke.py', 'maintenance-smoke.py', 'api-smoke.py']:
            subprocess.run([sys.executable, str(ROOT / 'tests' / name)], env=env, check=True)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
