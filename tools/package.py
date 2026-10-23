"""Package the static review build without Git metadata or development runtimes.
Usage: python tools/package.py /path/outside/checkout/mirror-me.zip
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
files = [root / 'index.html', root / 'style.css', root / 'ATTRIBUTIONS.md']
for folder in ('src', 'vendor', 'assets'):
    files.extend(p for p in sorted((root / folder).rglob('*')) if p.is_file())
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        if path.is_symlink():
            raise ValueError(f'Refusing a symlink in runtime files: {path}')
        archive.write(path, path.relative_to(root))
    archive.writestr('READ_ME_FIRST.txt', '''MIRROR ME — FIRST ENCOUNTER / LOCAL REVIEW BUILD
Original concept and direction: Skewernet. AI-assisted development: ChatGPT/Codex.

Extract the entire archive. From the extracted folder, run:
  python -m http.server 8000 --bind 127.0.0.1
Then open the local server in a desktop WebGL browser and click ENTER.
Do not double-click index.html; JavaScript modules need an HTTP server.
No build, external asset service, credentials or installation is needed to play.

WASD/arrow keys walk. Mouse looks. E interacts. Tab opens/closes your pocket.
Escape pauses. Comfort and sound controls are in the menu.
Look at the folded note and pay attention to the mirror.

This is a short first encounter, not the complete jam game.
The seven voice takes are synthetic provisional performances, not human acting.
See ATTRIBUTIONS.md and assets/voice/README.md for licenses and provenance.

This archive has not been deployed or submitted anywhere.
''')
print(f'{output}: {len(files) + 1} files, {output.stat().st_size:,} bytes')
