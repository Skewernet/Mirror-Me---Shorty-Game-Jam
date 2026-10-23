"""Explicit owner-authorized Pages deployment. Never run automatically at startup.
Creates only mirror-me, and only after an authenticated project lookup returns 404.
Requires credentials in secure environment settings; never prints credential values.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote
import hashlib
import json
import os
import subprocess
import sys
import time
from stage_pages import ROOT, stage

PROJECT = 'mirror-me'
WRANGLER = Path('/workspace/mirror-me-tools/cloudflare/node_modules/.bin/wrangler')

def request_json(url, token=None):
    headers = {'Accept': 'application/json', 'Cache-Control': 'no-cache'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urlopen(Request(url, headers=headers), timeout=25) as response:
        return json.load(response)

def main():
    token, account = os.environ.get('CLOUDFLARE_API_TOKEN'), os.environ.get('CLOUDFLARE_ACCOUNT_ID')
    missing = [name for name in ('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID') if not os.environ.get(name)]
    if missing:
        raise RuntimeError('Missing secure environment settings: ' + ', '.join(missing) + '. Do not paste credentials into chat.')
    if not WRANGLER.exists():
        raise RuntimeError('Run the saved environment installation script to install pinned Wrangler first.')
    subprocess.run(['node', '--test', 'tests/physics.test.mjs', 'tests/story.test.mjs'], cwd=ROOT, check=True)
    output, manifest = stage()
    endpoint = 'https://api.cloudflare.com/client/v4/accounts/' + quote(account, safe='') + '/pages/projects/' + PROJECT
    env = dict(os.environ, CI='true', WRANGLER_SEND_METRICS='false', XDG_CONFIG_HOME='/workspace/mirror-me-tools/config')
    try:
        result = request_json(endpoint, token)
    except HTTPError as error:
        if error.code != 404:
            raise RuntimeError(f'Authenticated project lookup failed: HTTP {error.code}. No project was created.') from None
        subprocess.run([str(WRANGLER), 'pages', 'project', 'create', PROJECT, '--production-branch', 'main'], cwd=WRANGLER.parents[2], env=env, check=True)
        result = request_json(endpoint, token)
    if not result.get('success') or result.get('result', {}).get('name') != PROJECT:
        raise RuntimeError('Could not positively identify the requested Pages project. No upload attempted.')
    project = result['result']
    branch = project.get('production_branch')
    if not branch:
        raise RuntimeError('The existing project does not report its production branch. No upload attempted.')
    print(f'Uploading tested revision {manifest["revision"]} to {PROJECT} on its production branch {branch}.', flush=True)
    subprocess.run([str(WRANGLER), 'pages', 'deploy', str(output), '--project-name', PROJECT, '--branch', branch, '--commit-hash', manifest['revision'], '--commit-message', 'MIRROR ME first playable mirror encounter'], cwd=WRANGLER.parents[2], env=env, check=True)
    project = request_json(endpoint, token)['result']
    subdomain = project.get('subdomain', '')
    if not subdomain.endswith('.pages.dev'):
        raise RuntimeError('Upload returned, but the Pages hostname is unavailable; live validation remains incomplete.')
    base = 'https://' + subdomain
    revision = manifest['revision']
    deployed = None
    for attempt in range(12):
        try:
            candidate = request_json(base + '/build-id.json?revision=' + revision)
            if candidate.get('revision') == revision:
                deployed = candidate
                break
        except (HTTPError, URLError, ValueError):
            pass
        if attempt < 11:
            print(f'Waiting for production revision ({attempt + 1}/12)…', flush=True)
            time.sleep(5)
    if not deployed:
        raise RuntimeError('Upload completed, but production build-id could not be verified. Do not claim the build is live.')
    for name, expected in manifest['files'].items():
        with urlopen(Request(base + '/' + quote(name) + '?revision=' + revision, headers={'Cache-Control': 'no-cache'}), timeout=25) as response:
            actual = hashlib.sha256(response.read()).hexdigest()
        if actual != expected:
            raise RuntimeError('Production asset differs from the tested build: ' + name)
    receipt = {'url': base, 'project': PROJECT, 'revision': revision, 'verified_assets': len(manifest['files']), 'canonical_deployment_id': (project.get('canonical_deployment') or {}).get('id')}
    receipt_path = output.parent / 'cloudflare-deployment.json'
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print('Verified exact production assets:', base)
    print('Deployment receipt:', receipt_path)

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, HTTPError, URLError, subprocess.CalledProcessError) as error:
        print(f'Deployment blocked: {error}', file=sys.stderr)
        sys.exit(1)
