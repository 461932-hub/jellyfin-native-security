"""Inspect Docker Compose's resolved model for CasaOS import compatibility."""
import json
import subprocess

model = json.loads(subprocess.check_output([
    'docker', 'compose', '-f', 'CasaOS-Import.yaml', 'config', '--format', 'json',
], text=True))
service = model['services']['jellyfin']
assert not model.get('volumes'), 'CasaOS must not receive named-volume definitions'
assert all(volume['type'] == 'bind' for volume in service['volumes'])
mounts = {volume['target']: volume for volume in service['volumes']}
assert mounts['/config']['source'] == '/DATA/AppData/jellyfin-native-security-test/config'
assert mounts['/cache']['source'] == '/DATA/AppData/jellyfin-native-security-test/cache'
assert mounts['/Media']['read_only'] and mounts['/HDD']['read_only']
port, = service['ports']
assert int(port['published']) == 8099 and port['target'] == 8096
assert service['user'] == '0:0'
assert {cap.removeprefix('CAP_') for cap in service['cap_add']} == {'CHOWN', 'SETUID', 'SETGID'}
assert {cap.removeprefix('CAP_') for cap in service['cap_drop']} == {'ALL'}
assert '[object Object]' not in str(model)
print('CasaOS import: absolute bind paths, 8099->8096 and limited bootstrap capabilities validated.')
