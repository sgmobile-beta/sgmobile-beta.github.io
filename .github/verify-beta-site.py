"""Verify the release manifest and exact static files selected for Pages."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def file_info(path):
    return {'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    site = Path(__file__).resolve().parent.parent / 'site'
    require(site.is_dir() and not site.is_symlink(), 'No reviewed site directory is staged.')
    files = {}
    for path in site.rglob('*'):
        require(not path.is_symlink(), f'Symlink in site: {path}')
        if path.is_file():
            files[path.relative_to(site).as_posix()] = file_info(path)
        else:
            require(path.is_dir(), f'Special file in site: {path}')
    manifest_hash = os.environ.get('REVIEWED_MANIFEST_SHA256', '')
    require(re.fullmatch(r'[a-f0-9]{64}', manifest_hash), 'Supply the reviewed release.json SHA-256.')
    require(files.get('release.json', {}).get('sha256') == manifest_hash, 'The release manifest does not match the reviewed hash.')
    release = json.loads((site / 'release.json').read_bytes())
    require(release.get('schema') == 1 and isinstance(release.get('files'), list), 'Invalid release manifest.')
    build = release.get('build')
    require(isinstance(build, str) and re.fullmatch(r'sgmobile-beta[A-Za-z0-9_-]*', build), 'Expected an SGMobile Beta build.')
    listed = {}
    for entry in release['files']:
        name = entry.get('path', '')
        relative = PurePosixPath(name)
        require(name and not relative.is_absolute() and relative.as_posix() == name
                and '..' not in relative.parts and name not in listed, f'Invalid or duplicate manifest path: {name}')
        listed[name] = {'bytes': entry.get('bytes'), 'sha256': entry.get('sha256')}
    require(files.get('.nojekyll', {}).get('bytes') == 0, 'Expected an empty .nojekyll.')
    require({k: v for k, v in files.items() if k not in {'.nojekyll', 'release.json'}} == listed,
            'Site files do not match the reviewed manifest inventory.')
    require({'index.html', 'golf.html', 'golf.wasm', 'manifest.webmanifest', 'service-worker.js'} <= listed.keys(),
            'The reviewed package is missing core site files.')
    identity = json.loads((site / 'manifest.webmanifest').read_bytes())
    require((identity.get('id'), identity.get('scope'), identity.get('start_url'), identity.get('display')) ==
            ('/sgmobile-beta', '/', '/golf.html?hd=0&mobile=1', 'standalone'), 'Wrong PWA identity or scope.')
    worker = (site / 'service-worker.js').read_text()
    html = (site / 'golf.html').read_text()
    require(f"const BUILD = '{build}';" in worker and f"id: '{build}'" in html, 'Mixed app build identities.')
    require("const CACHE = 'sgmobile-beta-app-' + BUILD;" in worker, 'Wrong Beta cache namespace.')
    require('dev-usage-preview.js' not in files, 'Developer telemetry is not a public app resource.')
    for name in listed:
        if name.endswith(('.js', '.html', '.json')):
            data = (site / name).read_bytes()
            if name == 'usage-totals.js':
                endpoint = b'https://sgmobile-dev-usage.sgmobile-fourtempers.workers.dev/totals'
                require(data.count(endpoint) == 1 and b"method: 'GET'" in data and
                        b'/collect' not in data, 'Expected the read-only Development totals reader.')
                data = data.replace(endpoint, b'', 1)
            require(b'sgmobile-dev-usage.sgmobile-' not in data, f'Developer collector in {name}')
    print(f'Verified {len(files)} files for {build}.')


if __name__ == '__main__':
    main()
