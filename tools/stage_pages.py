"""Prepare an immutable static upload folder outside the checkout. No network writes."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def stage(parent=Path('/workspace/artifacts')):
    revision = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    if subprocess.check_output(['git', '-C', str(ROOT), 'status', '--porcelain'], text=True).strip():
        raise RuntimeError('Commit or preserve working changes before preparing an identified production build.')
    files = [ROOT / 'index.html', ROOT / 'style.css', ROOT / 'ATTRIBUTIONS.md']
    for folder in ('src', 'vendor', 'assets'):
        files.extend(p for p in sorted((ROOT / folder).rglob('*')) if p.is_file())
    payload = {}
    for path in files:
        if path.is_symlink():
            raise RuntimeError(f'Unexpected symlink in runtime assets: {path.relative_to(ROOT)}')
        payload[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    manifest = {
        'project': 'mirror-me', 'version': 'first-encounter-0.2', 'revision': revision,
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()},
    }
    payload['build-id.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    output = Path(parent) / f'mirror-me-pages-{revision[:12]}'
    if output.exists():
        actual = {p.relative_to(output).as_posix(): p.read_bytes() for p in output.rglob('*') if p.is_file()}
        if actual != payload:
            raise RuntimeError(f'Existing output differs; preserve it and use another parent directory: {output}')
    else:
        output.mkdir(parents=True)
        for name, data in payload.items():
            path = output / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    return output, manifest

if __name__ == '__main__':
    try:
        folder, manifest = stage(Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/workspace/artifacts'))
        print(folder)
        print(f"Prepared {len(manifest['files']) + 1} files for revision {manifest['revision']}.")
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Preparation blocked: {error}', file=sys.stderr)
        sys.exit(1)
