"""Exercise clean public installation on isolated Docker CI fixtures only."""
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

image = sys.argv[1]
assert image.startswith(('ghcr.io/461932-hub/jellyfin-native-security:', 'jellyfin-native-security:'))
assert sys.platform.startswith('linux'), 'This fixture requires Linux Docker'
root = Path(tempfile.mkdtemp(prefix='native-public-install-', dir='/tmp')).resolve()
containers = []
checks = []
caps = ['--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--cap-add', 'SETUID', '--cap-add', 'SETGID']


def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs).stdout.strip()


def note(name):
    checks.append({'name': name, 'passed': True})
    print('PASS ' + name, flush=True)


def info(port):
    c = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
    try:
        c.request('GET', '/System/Info/Public')
        r = c.getresponse()
        assert r.status == 200
        return json.loads(r.read(100000))
    finally:
        c.close()


def wait(port):
    for _ in range(90):
        try:
            return info(port)
        except (OSError, AssertionError, ValueError, http.client.HTTPException):
            time.sleep(1)
    raise AssertionError('Isolated first-run server did not become ready')


def start(label, port, uid='1000', gid='1000', extra=()):
    name = 'native-public-ci-' + label
    containers.append(name)
    config = root / label / 'config'
    cache = root / label / 'cache'
    config.mkdir(parents=True)
    cache.mkdir()
    # Reproduce fresh CasaOS directories, without importing any existing data.
    run('sudo', 'chown', '0:0', str(config), str(cache))
    run('docker', 'run', '--detach', '--name', name, '--read-only', *caps,
        '--security-opt', 'no-new-privileges:true', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m',
        '--publish', f'127.0.0.1:{port}:8096',
        '--env', f'PUID={uid}', '--env', f'PGID={gid}',
        '--mount', f'type=bind,source={config},target=/config',
        '--mount', f'type=bind,source={cache},target=/cache',
        '--mount', f'type=bind,source={root / "media"},target=/Media',
        *extra, image)
    return name, wait(port)


try:
    (root / 'media').mkdir()
    (root / 'hooks').mkdir()
    # Only test image content, not a running server's generated native defaults.
    pristine = run('docker', 'run', '--rm', '--user', '1000:1000', '--read-only', '--cap-drop', 'ALL',
                   '--entrypoint', '/bin/sh', image, '-c', 'find /config /cache -mindepth 1 -maxdepth 1 -print')
    assert not pristine, 'Image unexpectedly contains initialized config/cache'
    note('Published image has empty config/cache, without bundled users, database or libraries')
    a, first = start('a', 18098)
    # A harmless /dev/null character device stands in for a passed render node.
    # This checks permissions/group handling, not VA-API or actual GPU codecs.
    device = root / 'renderD128'
    run('sudo', 'mknod', '-m', '660', str(device), 'c', '1', '3')
    run('sudo', 'chown', '0:2304', str(device))
    (root / 'hooks' / '10-fixture.sh').write_text(
        '#!/bin/sh\nset -eu\ntest "$(id -u):$(id -g)" = 2001:2002\n'
        'test -r /dev/dri/renderD128 && test -w /dev/dri/renderD128\n'
        'id -G > /config/fixture-groups\nprintf "hook-ok\\n" > /config/fixture-hook\n')
    b, second = start('b', 18097, '2001', '2002', [
        '--group-add', '2303', '--device', f'{device}:/dev/dri/renderD128',
        '--mount', f'type=bind,source={root / "hooks"},target=/custom-cont-init.d,readonly'])
    assert first['StartupWizardCompleted'] is False and second['StartupWizardCompleted'] is False
    assert first['Id'] != second['Id']
    note('Two independent empty configurations start the original setup with different server IDs')
    process = run('docker', 'exec', '--user', '2001:2002', b, 'cat', '/proc/1/status')
    assert 'Uid:\t2001\t2001\t2001\t2001' in process
    assert 'Gid:\t2002\t2002\t2002\t2002' in process
    assert 'CapEff:\t0000000000000000' in process and 'NoNewPrivs:\t1' in process
    note('Configured PUID/PGID run the server without root, effective capabilities or new privileges')
    groups = run('docker', 'exec', '--user', '2001:2002', b, 'cat', '/config/fixture-groups').split()
    assert '2303' in groups and '2304' in groups and '0' not in groups
    assert run('docker', 'exec', '--user', '2001:2002', b, 'cat', '/config/fixture-hook') == 'hook-ok'
    assert run('stat', '-c', '%u:%g:%a', str(device)) == '0:2304:660'
    note('Docker supplementary groups, passed-device groups and unprivileged initialization hooks work without changing device permissions')
    browser_test = subprocess.run(['node', 'tests/first-run-browser.cjs'], env=os.environ.copy(),
                                  text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(browser_test.stdout, end='', flush=True)
    if browser_test.returncode:
        print(browser_test.stderr, file=sys.stderr, flush=True)
        raise AssertionError('Original browser first-run wizard failed')
    # Refuse accidental simultaneous reuse of a configuration rather than
    # allowing two servers to write the same SQLite database.
    collision = subprocess.run(['docker', 'run', '--rm', '--read-only', *caps,
        '--security-opt', 'no-new-privileges:true',
        '--mount', f'type=bind,source={root / "a/config"},target=/config',
        '--mount', f'type=bind,source={root / "a/cache"},target=/cache', image, 'true'],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert collision.returncode == 75, f'Configuration lock not enforced (exit {collision.returncode})'
    note('A second new container refuses a configuration already locked by a running server')
    run('docker', 'restart', a)
    after = wait(18098)
    assert after['StartupWizardCompleted'] is True and after['Id'] == first['Id']
    assert info(18097)['StartupWizardCompleted'] is False
    note('Restart preserves the completed setup and leaves the separate fresh server unconfigured')
    for port in [18098, 18097]:
        for endpoint in ['/Items/11111111111111111111111111111111/Images/Primary',
                         '/Videos/11111111111111111111111111111111/stream?Static=true']:
            c = http.client.HTTPConnection('127.0.0.1', port, timeout=10)
            try:
                c.request('GET', endpoint)
                r = c.getresponse()
                assert r.status == 401
                r.read(100000)
            finally:
                c.close()
    note('Anonymous image and video access stays denied before and after the original wizard')
    for invalid in ['0', '1000;id', '-1', '2147483648']:
        result = subprocess.run(['docker', 'run', '--rm', '--read-only', *caps, '--env', f'PUID={invalid}', image, 'true'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert result.returncode != 0
    note('Invalid or root runtime IDs are rejected without executing injected values')
    # Native writable-library operations remain available when mounts are writable.
    run('sudo', 'chown', '1000:1000', str(root / 'media'))
    run('docker', 'exec', '--user', '1000:1000', a, 'touch', '/Media/native-write-fixture')
    assert (root / 'media/native-write-fixture').exists()
    note('Original writable media-folder operations remain possible when the administrator grants write access')
    Path('test-results/public-install.json').write_text(json.dumps({
        'passed': True, 'checks': checks, 'platform': 'linux/amd64',
        'scope': 'Fresh isolated Docker fixtures with real original wizard; synthetic device only, no hardware-acceleration or live CasaOS UI claim'
    }, indent=2) + '\n')
finally:
    for name in containers:
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    assert root.parent == Path('/tmp') and root.name.startswith('native-public-install-') and not root.is_symlink()
    subprocess.run(['sudo', 'rm', '-rf', '--', str(root)], check=True)
