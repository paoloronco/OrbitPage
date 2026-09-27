import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

script = Path(__file__).with_name('orbitpage-update.py')
spec = importlib.util.spec_from_file_location('orbitpage_update', script)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class UpdatePlanTests(unittest.TestCase):
    def test_existing_docker_run_keeps_configuration_and_data_volume(self):
        container = {
            'Id': 'a' * 64,
            'Config': {
                'Hostname': 'a' * 12,
                'Image': 'paueron/orbitpage:latest',
                'Env': ['JWT_SECRET=existing-secret', 'BASE_PATH=/orbitpage'],
                'Labels': {'custom': 'kept'},
            },
            'HostConfig': {
                'Binds': [],
                'PortBindings': {'8080/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '9006'}]},
                'RestartPolicy': {'Name': 'unless-stopped'},
            },
            'Mounts': [{'Type': 'volume', 'Name': 'orbitpage-data-prod', 'Destination': '/app/data', 'RW': True}],
            'NetworkSettings': {'Networks': {'my-network': {'Aliases': ['orbitpage'], 'IPAMConfig': None}}},
        }

        plan = updater.create_payload(container, updater.target_image(container['Config']['Image']))

        self.assertEqual(plan['Image'], 'paoloronco/orbitpage:latest')
        self.assertEqual(plan['Env'], container['Config']['Env'])
        self.assertEqual(plan['HostConfig']['PortBindings'], container['HostConfig']['PortBindings'])
        self.assertEqual(plan['HostConfig']['RestartPolicy'], container['HostConfig']['RestartPolicy'])
        self.assertEqual(plan['HostConfig']['Binds'], ['orbitpage-data-prod:/app/data:rw'])
        self.assertEqual(plan['NetworkingConfig']['EndpointsConfig']['my-network']['Aliases'], ['orbitpage'])
        self.assertEqual(plan['Hostname'], '')
        self.assertEqual(container['HostConfig']['Binds'], [])

    def test_refuses_container_without_persistent_data(self):
        container = {'Config': {}, 'HostConfig': {}, 'Mounts': [], 'NetworkSettings': {'Networks': {}}}
        with self.assertRaisesRegex(RuntimeError, 'no persistent /app/data mount'):
            updater.create_payload(container, 'paoloronco/orbitpage:latest')

    def test_default_update_ignores_retired_demo_container(self):
        container = {'Name': '/orbitpage', 'Config': {'Image': 'paoloronco/orbitpage:latest', 'Labels': {}}}
        with patch.object(updater.os, 'geteuid', return_value=0, create=True), \
             patch.object(updater, 'SOURCE_FILE', Path('missing-update-source')), \
             patch.object(updater.sys, 'argv', ['orbitpage-update.py']), \
             patch.object(updater, 'run', return_value=SimpleNamespace(stdout='orbitpage\norbitpage-demo\n')), \
             patch.object(updater, 'docker_json', return_value=[container]) as inspect, \
             patch.object(updater, 'update_docker_run') as update:
            updater.main()

        inspect.assert_called_once_with('inspect', 'orbitpage')
        update.assert_called_once_with(container)


if __name__ == '__main__':
    unittest.main()
