"""Validate real Compose interpolation for portable, independent installations."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

checks = []


def model(file, app, port):
    env = {**os.environ, 'AppID': app}
    command = [os.environ['NATIVE_COMPOSE_EXE']] if os.environ.get('NATIVE_COMPOSE_EXE') else ['docker', 'compose']
    default = 8100 if 'Parallel' in file else 8096
    raw = Path(file).read_text().replace(f'published: "{default}"', f'published: "{port}"')
    raw = raw.replace(f'port_map: "{default}"', f'port_map: "{port}"')
    with tempfile.TemporaryDirectory(prefix='native-compose-port-') as directory:
        variant = Path(directory) / 'compose.yaml'
        variant.write_text(raw)
        return json.loads(subprocess.check_output(command + [
            '-p', app, '-f', str(variant), 'config', '--format', 'json'
        ], text=True, env=env))


for file in ['CasaOS-Import.yaml', 'CasaOS-Import-CPU.yaml', 'CasaOS-Import-Parallel.yaml', 'compose.yaml']:
    raw = Path(file).read_text()
    assert '192.168.' not in raw and 'jellyfin-native-security-test' not in raw
    assert 'container_name:' not in raw and '  id:' not in raw
    assert 'WEBUI_PORT' not in raw, 'CasaOS must receive numeric fields before interpolation'
    if file != 'compose.yaml':
        assert not any(line.startswith('name:') for line in raw.splitlines())
        assert '/DATA/AppData/$AppID/config' in raw
    previous = None
    for app, port in [('native-ci-first', 18098), ('native-ci-second', 18097)]:
        resolved = model(file, app, port)
        service = resolved['services']['jellyfin']
        assert not resolved.get('volumes')
        assert all(volume['type'] == 'bind' for volume in service['volumes'])
        mounts = {volume['target']: volume for volume in service['volumes']}
        assert mounts['/config']['source'] == f'/DATA/AppData/{app}/config'
        assert mounts['/cache']['source'] == f'/DATA/AppData/{app}/cache'
        assert mounts['/Media']['source'] == '/DATA/Media' and mounts['/HDD']['source'] == '/DATA/hdd'
        if previous:
            assert previous['/config']['source'] != mounts['/config']['source']
            assert previous['/cache']['source'] != mounts['/cache']['source']
        previous = mounts
        assert service['user'] == '0:0' and service['restart'] == 'unless-stopped'
        assert service['network_mode'] == 'bridge'
        assert {cap.removeprefix('CAP_') for cap in service['cap_add']} == {'CHOWN', 'SETUID', 'SETGID'}
        assert {cap.removeprefix('CAP_') for cap in service['cap_drop']} == {'ALL'}
        assert not service.get('privileged')
        env = service['environment']
        assert env['PUID'] == env['PGID'] == '1000'
        assert env['JELLYFIN_SecureMedia__PlaybackBaseUrl'] == ''
        assert env['JELLYFIN_SecureMedia__AllowInsecureHttpPlayback'] == 'false'
        assert env['JELLYFIN_SecureMedia__AllowInsecureHttpImages'] == 'false'
        ports = {(int(p['published']), p['target'], p['protocol']) for p in service['ports']}
        assert (port, 8096, 'tcp') in ports
        if 'Parallel' in file:
            assert len(ports) == 1
        else:
            assert ports == {(port, 8096, 'tcp'), (8920, 8920, 'tcp'), (7359, 7359, 'udp'), (1900, 1900, 'udp')}
        assert str(port) == str(resolved['x-casaos']['port_map'])
        if file in ['CasaOS-Import.yaml', 'CasaOS-Import-Parallel.yaml']:
            device, = service['devices']
            assert device['source'] == device['target'] == '/dev/dri'
        else:
            assert not service.get('devices')
        assert '[object Object]' not in str(resolved)
        checks.append({'name': f'{file}: {app} isolated paths, ports, identity and secure defaults', 'passed': True})

Path('test-results').mkdir(exist_ok=True)
Path('test-results/casaos-import.json').write_text(json.dumps({
    'passed': True, 'checks': checks,
    'scope': 'Docker Compose model with CasaOS AppID and operator-edited numeric host/Web-UI ports; nameless CasaOS projects follow upstream NewComposeAppFromYAML behaviour; not a live CasaOS UI test'
}, indent=2) + '\n')
print(f'PASS {len(checks)} public installation models: distinct data, correct protocols, identity, GPU/CPU and parallel variants.')
