import importlib.util
import unittest
import tempfile
import json
import socketserver
import threading
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

script = Path(__file__).with_name('orbitpage-update.py')
spec = importlib.util.spec_from_file_location('orbitpage_update', script)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class UpdatePlanTests(unittest.TestCase):
    @unittest.skipUnless(hasattr(socketserver, 'UnixStreamServer'), 'Linux host service uses Unix sockets')
    def test_real_host_socket_protocol_is_readable_and_rejects_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            data = Path(directory)
            def exercise(server):
                for method, body, expected in [('GET', None, 200), ('POST', '{"command":"id"}', 400)]:
                    thread = threading.Thread(target=server.handle_request)
                    thread.start()
                    connection = updater.UnixConnection(str(data / '.orbitpage-update.sock'))
                    connection.request(method, '/updates', body=body)
                    response = connection.getresponse()
                    result = json.loads(response.read())
                    self.assertEqual(response.status, expected)
                    self.assertTrue(result.get('enabled') if method == 'GET' else result.get('error'))
                    connection.close(); thread.join(timeout=5)
            with patch.object(updater, 'WEB_STATE_DIR', data / 'state'), \
                 patch.object(updater, 'web_update_directory', return_value=data), \
                 patch.object(updater, 'run', return_value=SimpleNamespace(stdout=str(updater.os.getuid()))), \
                 patch.object(updater.os, 'chown'), patch.object(socketserver.BaseServer, 'serve_forever', exercise):
                updater.serve_web_updates('orbitpage-test')

    def test_web_job_survives_restart_and_rejects_parallel_or_untrusted_requests(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(updater.threading.Thread, 'start'):
            state = updater.WebUpdateState('orbitpage-test', Path(directory))
            for version in ['v4.21.35', '4.21.35; rm -rf /', '../file', 42, '04.1.1']:
                with self.assertRaises(ValueError): state.start(version)
            state.start('4.21.35')
            with self.assertRaisesRegex(RuntimeError, 'already in progress'): state.start('4.21.35')
            restarted = updater.WebUpdateState('orbitpage-test', Path(directory))
            self.assertEqual(restarted.job['state'], 'failed')
            self.assertIn('service restarted', restarted.job['error'])

    def test_web_job_reports_logs_and_completes_only_after_version_verification(self):
        release = SimpleNamespace(read=lambda size: json.dumps({'tag_name': 'v4.21.35', 'draft': False, 'prerelease': False}).encode())
        def spawn(*args, **kwargs):
            kwargs['stdout'].write('Backup created\nHealth check passed\n')
            kwargs['stdout'].flush()
            return SimpleNamespace(poll=lambda: 0, returncode=0)
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(updater.threading.Thread, 'start'), \
             patch('urllib.request.urlopen') as fetch, \
             patch.object(updater, 'web_update_directory'), \
             patch.object(updater.subprocess, 'Popen', side_effect=spawn), \
             patch.object(updater, 'run', return_value=SimpleNamespace(stdout='4.21.35\n')):
            fetch.return_value.__enter__.return_value = release
            state = updater.WebUpdateState('orbitpage-test', Path(directory))
            state.start('4.21.35'); state.install('4.21.35')
            self.assertEqual(state.job['state'], 'completed')
            self.assertIn('Backup created', state.job['logs'])
            self.assertIn('v4.21.35 is running', state.job['logs'])
            self.assertEqual(updater.WebUpdateState('orbitpage-test', Path(directory)).job['state'], 'completed')
            state.start('4.21.36'); state.install('4.21.36')
            self.assertEqual(state.job['state'], 'failed')
            self.assertIn('not the latest official', state.job['error'])

    def test_web_job_timeout_finishes_with_an_explicit_failure(self):
        release = SimpleNamespace(read=lambda size: json.dumps({'tag_name': 'v4.21.35', 'draft': False, 'prerelease': False}).encode())
        process = SimpleNamespace(poll=lambda: None, pid=12345, wait=lambda timeout: 1)
        with tempfile.TemporaryDirectory() as directory, patch.object(updater.threading.Thread, 'start'), \
             patch('urllib.request.urlopen') as fetch, patch.object(updater, 'web_update_directory'), \
             patch.object(updater.subprocess, 'Popen', return_value=process), \
             patch.object(updater.time, 'monotonic', side_effect=[0, 1801]), \
             patch.object(updater.os, 'killpg', create=True) as kill:
            fetch.return_value.__enter__.return_value = release
            state = updater.WebUpdateState('orbitpage-test', Path(directory))
            state.start('4.21.35'); state.install('4.21.35')
            self.assertEqual(state.job['state'], 'failed')
            self.assertIn('exceeded 30 minutes', state.job['error'])
            kill.assert_called()

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

    def test_unhealthy_docker_update_restores_the_previous_container(self):
        container = {'Name': '/orbitpage-test', 'Config': {'Image': 'paoloronco/orbitpage:latest'}, 'Image': 'old-image', 'State': {'Running': True}}
        with patch.object(updater, 'create_payload', return_value={}), \
             patch.object(updater, 'docker_json', return_value=[{'Id': 'new-image'}]), \
             patch.object(updater, 'run') as run, patch.object(updater, 'backup_container'), \
             patch.object(updater, 'engine_request'), patch.object(updater.time, 'time', return_value=123), \
             patch.object(updater.subprocess, 'run', return_value=SimpleNamespace(returncode=0)), \
             patch.object(updater, 'verify_container', side_effect=RuntimeError('unhealthy')):
            with self.assertRaisesRegex(RuntimeError, 'unhealthy'): updater.update_docker_run(container)
            commands = [call.args for call in run.call_args_list]
            self.assertIn(('docker', 'rm', '-f', 'orbitpage-test'), commands)
            self.assertIn(('docker', 'rename', 'orbitpage-test-before-update-123', 'orbitpage-test'), commands)
            self.assertIn(('docker', 'start', 'orbitpage-test'), commands)

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
