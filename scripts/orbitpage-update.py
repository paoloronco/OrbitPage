#!/usr/bin/env python3
"""Update an existing self-hosted installation without replacing its configuration."""

import http.client
import json
import os
import re
import signal
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import threading
import uuid
from pathlib import Path
from urllib.parse import quote

SOURCE_FILE = Path('/etc/orbitpage/update-source')
BACKUP_DIR = Path('/var/backups/orbitpage')
WEB_STATE_DIR = Path('/var/lib/orbitpage-updates')
OFFICIAL_IMAGES = ('paoloronco/orbitpage', 'ghcr.io/paoloronco/orbitpage', 'paueron/orbitpage')


def run(*args, capture=False, user=None):
    command = list(args)
    if user is not None and user != 0:
        command = ['sudo', '-u', f'#{user}', '-H', '--', *command]
    return subprocess.run(command, check=True, text=True, capture_output=capture, timeout=900)


def docker_json(*args):
    return json.loads(run('docker', *args, capture=True).stdout)


def target_image(image):
    name = image.removeprefix('docker.io/').split('@', 1)[0].split(':', 1)[0]
    if name not in OFFICIAL_IMAGES:
        raise RuntimeError(f'Unsupported image {image!r}; update this custom image with its own build process.')
    if name == 'paueron/orbitpage':
        name = 'paoloronco/orbitpage'
    return f'{name}:latest'


def backup_container(name):
    print('[update] Backing up persistent data', flush=True)
    BACKUP_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
    archive = BACKUP_DIR / f'{name}-{stamp}-{os.getpid()}.tar'
    with archive.open('xb') as output:
        os.chmod(archive, 0o600)
        subprocess.run(['docker', 'cp', f'{name}:/app/data', '-'], check=True, stdout=output, timeout=900)
    print(f'Backup: {archive}')
    return archive


def compose_command(container):
    labels = container['Config'].get('Labels') or {}
    project = labels.get('com.docker.compose.project')
    service = labels.get('com.docker.compose.service')
    directory = labels.get('com.docker.compose.project.working_dir')
    files = labels.get('com.docker.compose.project.config_files')
    if not all((project, service, directory, files)):
        raise RuntimeError('Compose metadata is incomplete; run the update from the original Compose directory.')
    if not Path(directory).is_dir():
        raise RuntimeError(f'Compose directory is missing: {directory}')
    command = ['docker', 'compose', '--project-name', project, '--project-directory', directory]
    for file in files.split(','):
        if not Path(file).is_file():
            raise RuntimeError(f'Compose file is missing: {file}')
        command += ['--file', file]
    return command, service


class UnixConnection(http.client.HTTPConnection):
    def __init__(self, path):
        super().__init__('localhost', timeout=30)
        self.path = path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.path)


def engine_request(method, path, body=None):
    endpoint = run('docker', 'context', 'inspect', '--format', '{{(index .Endpoints "docker").Host}}', capture=True).stdout.strip()
    if not endpoint.startswith('unix://'):
        raise RuntimeError('Automatic Docker Run updates require a local Unix Docker socket.')
    version = run('docker', 'version', '--format', '{{.Server.APIVersion}}', capture=True).stdout.strip()
    connection = UnixConnection(endpoint.removeprefix('unix://'))
    payload = None if body is None else json.dumps(body).encode()
    connection.request(method, f'/v{version}{path}', body=payload,
                       headers={'Content-Type': 'application/json'} if payload else {})
    response = connection.getresponse()
    data = response.read()
    connection.close()
    result = json.loads(data) if data else {}
    if response.status >= 300:
        raise RuntimeError(f'Docker Engine: {result.get("message", response.reason)}')
    return result


def create_payload(container, image):
    mounts = container.get('Mounts') or []
    if not any(mount.get('Destination') == '/app/data' and mount.get('Type') in ('bind', 'volume') for mount in mounts):
        raise RuntimeError('The container has no persistent /app/data mount; update stopped to protect its data.')
    config = dict(container['Config'])
    host = dict(container['HostConfig'])
    if host.get('VolumesFrom') or host.get('ContainerIDFile'):
        raise RuntimeError('VolumesFrom or ContainerIDFile needs a manual Docker update.')
    networks = container['NetworkSettings'].get('Networks') or {}
    if any((network.get('IPAMConfig') or {}).get('IPv4Address') or
           (network.get('IPAMConfig') or {}).get('IPv6Address') for network in networks.values()):
        raise RuntimeError('Static container IP needs a manual Docker update.')
    if config.get('Hostname') == container['Id'][:12]:
        config['Hostname'] = ''
    config['Image'] = image
    explicit_mounts = list(host.get('Binds') or [])
    structured_mounts = host.get('Mounts') or []
    for mount in mounts:
        destination = mount.get('Destination')
        if mount.get('Type') not in ('bind', 'volume') or not destination:
            continue
        if any(bind.split(':')[1:2] == [destination] for bind in explicit_mounts) or any(
            entry.get('Target') == destination for entry in structured_mounts
        ):
            continue
        source = mount.get('Name') if mount['Type'] == 'volume' else mount.get('Source')
        if not source:
            raise RuntimeError(f'The {destination} mount source is unavailable.')
        mode = mount.get('Mode') or ('rw' if mount.get('RW') else 'ro')
        explicit_mounts.append(f'{source}:{destination}:{mode}')
    host['Binds'] = explicit_mounts
    host['PortBindings'] = dict(host.get('PortBindings') or {})
    for port, bindings in (container['NetworkSettings'].get('Ports') or {}).items():
        if bindings and not host['PortBindings'].get(port):
            host['PortBindings'][port] = bindings
    endpoints = {}
    for name, network in networks.items():
        endpoints[name] = {
            'Aliases': network.get('Aliases') or [],
            'Links': network.get('Links') or [],
            'DriverOpts': network.get('DriverOpts') or {},
        }
    return {**config, 'HostConfig': host,
            'NetworkingConfig': {'EndpointsConfig': endpoints}}


def verify_container(name, image_id):
    print('[update] Checking application health and image', flush=True)
    for _ in range(30):
        state = docker_json('inspect', name)[0]['State']
        if state.get('Running') and (not state.get('Health') or state['Health']['Status'] == 'healthy'):
            actual = docker_json('inspect', name)[0]['Image']
            if actual != image_id:
                raise RuntimeError(f'{name} still uses image {actual}, expected {image_id}')
            print(f'{name}: updated and running ({image_id})')
            return
        if state.get('Status') in ('exited', 'dead') or (state.get('Health') or {}).get('Status') == 'unhealthy':
            break
        time.sleep(2)
    raise RuntimeError(f'{name} did not become healthy; inspect its logs and the backup before rollback.')


def update_docker_run(container):
    name = container['Name'].lstrip('/')
    image = target_image(container['Config']['Image'])
    payload = create_payload(container, image)
    print(f'[update] Downloading {image}', flush=True)
    run('docker', 'pull', image)
    image_id = docker_json('image', 'inspect', image)[0]['Id']
    if container['Image'] == image_id:
        print(f'{name}: already uses the latest image')
        return
    was_running = container['State']['Running']
    old_name = f'{name}-before-update-{int(time.time())}'
    if was_running:
        print('[update] Stopping OrbitPage for a consistent backup', flush=True)
        run('docker', 'stop', name)
    try:
        backup_container(name)
    except Exception:
        if was_running:
            run('docker', 'start', name)
        raise
    try:
        run('docker', 'rename', name, old_name)
    except Exception:
        if was_running:
            run('docker', 'start', name)
        raise
    try:
        print('[update] Recreating OrbitPage with the preserved configuration', flush=True)
        engine_request('POST', f'/containers/create?name={quote(name)}', payload)
        if was_running:
            engine_request('POST', f'/containers/{quote(name)}/start')
            verify_container(name, image_id)
    except Exception:
        if subprocess.run(['docker', 'inspect', name], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, check=False, timeout=30).returncode == 0:
            run('docker', 'rm', '-f', name)
        run('docker', 'rename', old_name, name)
        if was_running:
            run('docker', 'start', name)
        raise
    if not was_running:
        print(f'{name}: updated; container remains stopped')
    run('docker', 'rm', old_name)


def update_compose(containers):
    command, service = compose_command(containers[0])
    for container in containers:
        image = container['Config']['Image']
        if image.removeprefix('docker.io/') != target_image(image):
            raise RuntimeError(f'Compose image {image!r} is pinned or legacy. Change it to the current :latest image in the Compose file first.')
    print(f'[update] Downloading the configured image for {service}', flush=True)
    run(*command, 'pull', service)
    image_id = docker_json('image', 'inspect', containers[0]['Config']['Image'])[0]['Id']
    if all(container['Image'] == image_id for container in containers):
        print(f'Compose {service}: already uses the latest image')
        return
    try:
        for container in containers:
            if container['State']['Running']:
                run('docker', 'stop', container['Name'].lstrip('/'))
            backup_container(container['Name'].lstrip('/'))
    except Exception:
        run(*command, 'start', service)
        raise
    try:
        print('[update] Recreating the Compose service', flush=True)
        run(*command, 'up', '-d', '--no-deps', service)
        for container in containers:
            verify_container(container['Name'].lstrip('/'), image_id)
    except Exception:
        print('[update] Restoring the previous image after update failure', flush=True)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as override:
            json.dump({'services': {service: {'image': containers[0]['Image']}}}, override)
            override.flush()
            run(*command, '--file', override.name, 'up', '-d', '--no-deps', '--pull', 'never', '--no-build', service)
        raise


def update_source(root):
    app = root / 'app'
    if not (root / '.git').exists() or not (app / 'package.json').is_file():
        raise RuntimeError(f'Not an OrbitPage source checkout: {root}')
    owner = root.stat().st_uid
    run('git', '-C', str(root), 'pull', '--ff-only', user=owner)
    run('npm', 'ci', '--prefix', str(app), user=owner)
    run('npm', 'ci', '--prefix', str(app / 'server'), user=owner)
    run('npm', 'run', 'build', '--prefix', str(app), user=owner)
    if shutil.which('systemctl') and subprocess.run(['systemctl', 'is-active', '--quiet', 'orbitpage'], check=False).returncode == 0:
        run('systemctl', 'restart', 'orbitpage')
        print('Source updated; orbitpage systemd service restarted.')
    else:
        print('Source updated. Restart the running OrbitPage process to load the new version.')


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run with sudo: sudo orbitpage-update')
    if len(sys.argv) == 3 and sys.argv[1] == '--enable-web-updates':
        enable_web_updates(sys.argv[2])
        return
    if len(sys.argv) == 3 and sys.argv[1] == '--serve-web-updates':
        serve_web_updates(sys.argv[2])
        return
    if len(sys.argv) == 3 and sys.argv[1] == '--register-source':
        root = Path(sys.argv[2]).resolve()
        if not (root / '.git').exists() or not (root / 'app' / 'package.json').is_file():
            raise RuntimeError(f'Not an OrbitPage source checkout: {root}')
        SOURCE_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        SOURCE_FILE.write_text(str(root) + '\n')
        os.chmod(SOURCE_FILE, 0o600)
        print(f'Source installation registered: {root}')
        return
    if SOURCE_FILE.is_file() and len(sys.argv) == 1:
        update_source(Path(SOURCE_FILE.read_text().strip()))
        return
    names = run('docker', 'ps', '-a', '--format', '{{.Names}}', capture=True).stdout.splitlines()
    selected = []
    requested = sys.argv[1:]
    for name in names:
        if name == 'orbitpage-demo' and not requested:
            continue
        container = docker_json('inspect', name)[0]
        try:
            target_image(container['Config']['Image'])
        except RuntimeError:
            continue
        if not requested or name in requested:
            selected.append(container)
    if requested and {c['Name'].lstrip('/') for c in selected} != set(requested):
        raise RuntimeError('A requested OrbitPage container was not found.')
    if not selected:
        raise RuntimeError('No OrbitPage installation found. For source installs, register it with --register-source /path/to/OrbitPage.')
    groups = {}
    for container in selected:
        labels = container['Config'].get('Labels') or {}
        key = (labels.get('com.docker.compose.project'), labels.get('com.docker.compose.service'))
        if key[0]:
            groups.setdefault(key, []).append(container)
        else:
            update_docker_run(container)
    for containers in groups.values():
        update_compose(containers)


def web_update_directory(name):
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}', name):
        raise RuntimeError('Pass a single valid OrbitPage container name.')
    endpoint = run('docker', 'context', 'inspect', '--format', '{{(index .Endpoints "docker").Host}}', capture=True).stdout.strip()
    if not endpoint.startswith('unix://'):
        raise RuntimeError('Web updates require Docker on this Linux host.')
    container = docker_json('inspect', name)[0]
    image = container['Config']['Image'].removeprefix('docker.io/')
    if image != target_image(image):
        raise RuntimeError('Web updates require an official :latest image. Pinned images stay under operator control.')
    mount = next((m for m in container.get('Mounts', []) if m.get('Destination') == '/app/data' and m.get('RW')), None)
    if not mount or mount.get('Type') not in ('bind', 'volume'):
        raise RuntimeError('Web updates require a writable persistent /app/data mount.')
    directory = Path(mount['Source']).resolve(strict=True)
    if not directory.is_dir() or directory == Path('/'):
        raise RuntimeError('Invalid persistent data directory.')
    return directory


def enable_web_updates(name):
    web_update_directory(name)
    if not shutil.which('systemctl'):
        raise RuntimeError('Web updates require a Linux host with systemd. Use the terminal updater on this host.')
    service = f'orbitpage-updates-{name}.service'
    unit = Path('/etc/systemd/system') / service
    unit.write_text('[Unit]\nDescription=OrbitPage host update monitor\nAfter=docker.service\n'
                    '[Service]\nType=simple\n'
                    f'ExecStart=/usr/bin/python3 /usr/local/lib/orbitpage/orbitpage-update.py --serve-web-updates {name}\n'
                    'Restart=on-failure\nRestartSec=5\nUMask=0077\n'
                    '[Install]\nWantedBy=multi-user.target\n')
    os.chmod(unit, 0o644)
    run('systemctl', 'daemon-reload')
    run('systemctl', 'enable', '--now', service)
    print(f'Web updates enabled for {name}. Logs: journalctl -u {service}')


class WebUpdateState:
    def __init__(self, name, directory):
        self.name, self.directory = name, directory
        self.lock = threading.Lock()
        self.file = directory / 'status.json'
        self.job = json.loads(self.file.read_text()) if self.file.is_file() else None
        if self.job and self.job['state'] in ('queued', 'running'):
            self.finish('failed', 'The updater service restarted. Check the server and backup before retrying.')

    def save(self):
        self.job['updatedAt'] = time.time()
        with tempfile.NamedTemporaryFile(mode='w', dir=self.directory, delete=False) as output:
            json.dump(self.job, output)
        Path(output.name).replace(self.file)

    def finish(self, state, error=None):
        self.job.update(state=state, error=error)
        self.save()

    def start(self, version):
        if not isinstance(version, str) or len(version) > 64:
            raise ValueError('Invalid stable version.')
        parts = version.split('.')
        if len(parts) != 3 or any(not part.isascii() or not part.isdecimal() or (len(part) > 1 and part[0] == '0') for part in parts):
            raise ValueError('Invalid stable version.')
        with self.lock:
            if self.job and self.job['state'] in ('queued', 'running'):
                raise RuntimeError('An update is already in progress.')
            previous = self.job
            self.job = dict(id=str(uuid.uuid4()), state='queued', version=version,
                            startedAt=time.time(), logs='', error=None)
            try:
                self.save()
            except OSError as error:
                self.job = previous
                raise RuntimeError(f'Cannot persist update status: {error}') from error
            threading.Thread(target=self.install, args=(version,), daemon=True).start()

    def install(self, version):
        from urllib.request import urlopen, Request
        process = None
        try:
            with urlopen(Request('https://api.github.com/repos/paoloronco/OrbitPage/releases/latest',
                                 headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'OrbitPage-updater'}), timeout=8) as response:
                release = json.loads(response.read(65536))
            if release.get('draft') is not False or release.get('prerelease') is not False or release.get('tag_name') != f'v{version}':
                raise RuntimeError('The requested version is not the latest official stable release. Check for updates again.')
            web_update_directory(self.name)
            with self.lock:
                self.job['state'] = 'running'
                self.job['logs'] = 'Starting the host updater. Dashboard changes are locked.\n'
                self.save()
            log_path = self.directory / 'update.log'
            with log_path.open('w') as output:
                process = subprocess.Popen([sys.executable, '-u', str(Path(__file__).resolve()), self.name],
                                           stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
                deadline = time.monotonic() + 1800
                while process.poll() is None:
                    with self.lock:
                        with log_path.open('rb') as log:
                            log.seek(max(0, log_path.stat().st_size - 65536))
                            self.job['logs'] = log.read().decode('utf-8', errors='replace')
                        self.save()
                    if time.monotonic() >= deadline:
                        os.killpg(process.pid, signal.SIGTERM)
                        try: process.wait(timeout=10)
                        except subprocess.TimeoutExpired:
                            os.killpg(process.pid, signal.SIGKILL)
                            process.wait(timeout=10)
                        raise RuntimeError('Update exceeded 30 minutes. Check the server and backup before retrying.')
                    time.sleep(1)
            with self.lock:
                with log_path.open('rb') as log:
                    log.seek(max(0, log_path.stat().st_size - 65536))
                    self.job['logs'] = log.read().decode('utf-8', errors='replace')
            if process.returncode != 0:
                raise RuntimeError(f'Host updater failed (exit {process.returncode}). Review the logs before retrying.')
            installed = run('docker', 'exec', self.name, 'node', '-p', 'require("./package.json").version', capture=True).stdout.strip()
            if installed != version:
                raise RuntimeError(f'The server reports v{installed}, expected v{version}. Check the running container.')
            with self.lock:
                self.job['logs'] += f'\nUpdate completed. OrbitPage v{installed} is running.\n'
                self.finish('completed')
        except Exception as error:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=10)
            with self.lock:
                self.finish('failed', str(error))


def serve_web_updates(name):
    import socketserver
    import stat
    from http.server import BaseHTTPRequestHandler
    data = web_update_directory(name)
    directory = WEB_STATE_DIR / name
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    state = WebUpdateState(name, directory)
    socket_path = data / '.orbitpage-update.sock'
    if socket_path.exists() or socket_path.is_symlink():
        if not stat.S_ISSOCK(socket_path.lstat().st_mode):
            raise RuntimeError('Refusing to replace a non-socket update path.')
        socket_path.unlink()

    class Handler(BaseHTTPRequestHandler):
        def respond(self, code, body):
            payload = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if self.path != '/updates': return self.respond(404, {'error': 'Not found.'})
            with state.lock: self.respond(200, {'enabled': True, 'job': state.job})

        def do_POST(self):
            if self.path != '/updates': return self.respond(404, {'error': 'Not found.'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 1024: raise ValueError('Invalid request size.')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or set(body) != {'version'}: raise ValueError('Only a stable version can be requested.')
                state.start(body['version'])
                with state.lock: self.respond(202, {'enabled': True, 'job': state.job})
            except (ValueError, TypeError) as error: self.respond(400, {'error': str(error)})
            except RuntimeError as error: self.respond(409, {'error': str(error)})

        def log_message(self, *args): pass

        def setup(self):
            self.request.settimeout(5)
            super().setup()

    class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
        daemon_threads = True
    with Server(str(socket_path), Handler) as server:
        uid = int(run('docker', 'exec', name, 'id', '-u', capture=True).stdout.strip())
        gid = int(run('docker', 'exec', name, 'id', '-g', capture=True).stdout.strip())
        os.chown(socket_path, uid, gid)
        os.chmod(socket_path, 0o600)
        server.serve_forever()


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
        print(f'OrbitPage update failed: {error}', file=sys.stderr)
        sys.exit(1)
