"""Deploy only on an explicit release task; never run at environment startup.
--github-build tests the Git-connected build; --verify-only performs no upload.
Default mode uses official Wrangler Direct Upload to the existing project.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from stage_pages import ROOT, stage

PROJECT = 'mirror-me'
WRANGLER = Path('/workspace/mirror-me-tools/cloudflare/node_modules/.bin/wrangler')
# Cloudflare rejects Python's generic urllib agent on Pages (error 1010).
# Identify our own legitimate build verifier; retain HTTPS verification.
PUBLIC_HEADERS = {'User-Agent': 'MirrorMe-Deployment-Check/0.2', 'Cache-Control': 'no-cache'}


def request_json(url, token=None, method='GET', data=None, content_type=None):
    headers = dict(PUBLIC_HEADERS, Accept='application/json')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if content_type:
        headers['Content-Type'] = content_type
    with urlopen(Request(url, headers=headers, method=method, data=data), timeout=30) as response:
        return json.load(response)


def verify_live(base, manifest, project, receipt_path):
    revision = manifest['revision']
    for attempt in range(12):
        try:
            candidate = request_json(base + '/build-id.json?revision=' + revision)
            if candidate.get('revision') == revision:
                break
        except (HTTPError, URLError, ValueError):
            pass
        if attempt == 11:
            raise RuntimeError('Production build-id was not verified. An upload/build alone is not proof the game is live.')
        print(f'Waiting for production revision ({attempt + 1}/12)…', flush=True)
        time.sleep(5)
    for name, expected in manifest['files'].items():
        request = Request(base + '/' + quote(name) + '?revision=' + revision, headers=PUBLIC_HEADERS)
        with urlopen(request, timeout=25) as response:
            actual = hashlib.sha256(response.read()).hexdigest()
        if actual != expected:
            raise RuntimeError('Production asset differs from the tested build: ' + name)
    receipt = {
        'url': base, 'project': PROJECT, 'revision': revision,
        'verified_assets': len(manifest['files']),
        'canonical_deployment_id': (project.get('canonical_deployment') or {}).get('id'),
        'source_type': (project.get('source') or {}).get('type'),
        'production_branch': project.get('production_branch'),
    }
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print('Verified exact production assets:', base, flush=True)
    print('Deployment receipt:', receipt_path, flush=True)


def github_build(endpoint, token, branch, revision):
    boundary = 'MirrorMePagesBranchBuild'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="branch"\r\n\r\n{branch}\r\n--{boundary}--\r\n').encode()
    result = request_json(endpoint + '/deployments', token, 'POST', body, 'multipart/form-data; boundary=' + boundary)
    if not result.get('success'):
        raise RuntimeError('Cloudflare did not accept the Git build request.')
    deployment_id = result['result']['id']
    print('GitHub build requested:', deployment_id, flush=True)
    last_status = None
    for attempt in range(60):
        deployment = request_json(endpoint + '/deployments/' + deployment_id, token)['result']
        latest = deployment.get('latest_stage') or {}
        status = (latest.get('name'), latest.get('status'))
        if status != last_status:
            print('Git build:', *status, flush=True)
            last_status = status
        if latest.get('status') in ('failure', 'canceled'):
            raise RuntimeError('Git build did not complete successfully: ' + deployment_id)
        if latest.get('name') == 'deploy' and latest.get('status') == 'success':
            metadata = (deployment.get('deployment_trigger') or {}).get('metadata') or {}
            if metadata.get('commit_hash') != revision:
                raise RuntimeError('Cloudflare built a different Git commit; reconcile the remote before releasing again.')
            return
        time.sleep(5)
    raise RuntimeError('Git build has not completed; inspect its deployment status before claiming readiness.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    choice = parser.add_mutually_exclusive_group()
    choice.add_argument('--github-build', action='store_true')
    choice.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    missing = [name for name in ('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID') if not os.environ.get(name)]
    if missing:
        raise RuntimeError('Missing secure environment settings: ' + ', '.join(missing) + '. Never paste credentials into chat.')
    token, account = os.environ['CLOUDFLARE_API_TOKEN'], os.environ['CLOUDFLARE_ACCOUNT_ID']
    if not args.verify_only:
        subprocess.run(['node', '--test', 'tests/physics.test.mjs', 'tests/story.test.mjs'], cwd=ROOT, check=True)
    output, manifest = stage()
    endpoint = 'https://api.cloudflare.com/client/v4/accounts/' + quote(account, safe='') + '/pages/projects/' + PROJECT
    env = dict(os.environ, CI='true', WRANGLER_SEND_METRICS='false', XDG_CONFIG_HOME='/workspace/mirror-me-tools/config')
    try:
        result = request_json(endpoint, token)
    except HTTPError as error:
        if error.code != 404 or args.verify_only or args.github_build:
            raise RuntimeError(f'Authenticated project lookup failed: HTTP {error.code}. No project was created.') from None
        subprocess.run([str(WRANGLER), 'pages', 'project', 'create', PROJECT, '--production-branch', 'main'], cwd=WRANGLER.parents[2], env=env, check=True)
        result = request_json(endpoint, token)
    if not result.get('success') or (result.get('result') or {}).get('name') != PROJECT:
        raise RuntimeError('Could not positively identify the requested project. No upload attempted.')
    project = result['result']
    branch = project.get('production_branch')
    if not branch:
        raise RuntimeError('The production branch is unavailable. No upload attempted.')
    if args.github_build:
        if (project.get('source') or {}).get('type') != 'github':
            raise RuntimeError('The project is not connected to GitHub. No connection settings were changed.')
        github_build(endpoint, token, branch, manifest['revision'])
    elif not args.verify_only:
        if not WRANGLER.exists():
            raise RuntimeError('Install pinned Wrangler with the saved environment installation script.')
        print(f'Uploading revision {manifest["revision"]} to {PROJECT}, production branch {branch}.', flush=True)
        subprocess.run([str(WRANGLER), 'pages', 'deploy', str(output), '--project-name', PROJECT, '--branch', branch, '--commit-hash', manifest['revision'], '--commit-message', 'MIRROR ME first playable mirror encounter'], cwd=WRANGLER.parents[2], env=env, check=True)
    project = request_json(endpoint, token)['result']
    subdomain = project.get('subdomain', '')
    if not subdomain.endswith('.pages.dev'):
        raise RuntimeError('Pages hostname unavailable; public validation is incomplete.')
    verify_live('https://' + subdomain, manifest, project, output.parent / 'cloudflare-deployment.json')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, HTTPError, URLError, subprocess.CalledProcessError) as error:
        print(f'Deployment blocked: {error}', file=sys.stderr)
        sys.exit(1)
