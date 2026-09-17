import importlib.util
from pathlib import Path

script = Path(__file__).with_name('orbitpage-update.py')
spec = importlib.util.spec_from_file_location('orbitpage_update', script)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)

original = updater.docker_json('inspect', 'orbitpage-updater-test')[0]
payload = updater.create_payload(original, original['Config']['Image'])
updater.run('docker', 'stop', 'orbitpage-updater-test')
updater.engine_request('POST', '/containers/create?name=orbitpage-updater-recreated', payload)
updater.engine_request('POST', '/containers/orbitpage-updater-recreated/start')
updater.verify_container('orbitpage-updater-recreated', original['Image'])
recreated = updater.docker_json('inspect', 'orbitpage-updater-recreated')[0]
assert recreated['Config']['Env'] == original['Config']['Env']
assert recreated['HostConfig']['PortBindings'] == original['HostConfig']['PortBindings']
assert recreated['Mounts'][0]['Source'] == original['Mounts'][0]['Source']
print('Docker Run configuration survived container recreation.')
