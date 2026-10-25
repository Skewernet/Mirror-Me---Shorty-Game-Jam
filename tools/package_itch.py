"""Create a self-contained itch.io HTML5 ZIP from a clean, committed build."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile
from stage_pages import stage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[2] / 'artifacts')
args = parser.parse_args()
folder, manifest = stage(parent=args.output_dir)
archive = args.output_dir / f"MIRROR-ME-{manifest['revision'][:7]}-itch.zip"
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for path in sorted(folder.rglob('*')):
        if path.is_file():
            output.write(path, path.relative_to(folder).as_posix())
with zipfile.ZipFile(archive) as uploaded:
    assert 'index.html' in uploaded.namelist(), 'itch.io needs index.html at ZIP root'
    assert uploaded.testzip() is None, 'ZIP integrity verification failed'
    for name, digest in manifest['files'].items():
        assert hashlib.sha256(uploaded.read(name)).hexdigest() == digest, name
    uncompressed = sum(entry.file_size for entry in uploaded.infolist())
print(json.dumps({'zip': str(archive), 'revision': manifest['revision'], 'files': len(uploaded.namelist()),
                  'zipBytes': archive.stat().st_size, 'uncompressedBytes': uncompressed,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, indent=2))
