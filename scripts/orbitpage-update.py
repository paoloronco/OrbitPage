#!/usr/bin/env python3
"""Update an existing self-hosted installation without replacing its configuration."""

import http.client
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

SOURCE_FILE = Path('/etc/orbitpage/update-source')
BACKUP_DIR = Path('/var/backups/orbitpage')
OFFICIAL_IMAGES = ('paoloronco/orbitpage', 'ghcr.io/paoloronco/orbitpage', 'paueron/orbitpage')


def run(*args, capture=False, user=None):
    command = list(args)
    if user is not None and user != 0:
        command = ['sudo', '-u', f'#{user}', '-H', '--', *command]
    return subprocess.run(command, check=True, text=True, capture_output=capture)


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
    BACKUP_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
    archive = BACKUP_DIR / f'{name}-{stamp}-{os.getpid()}.tar'
    with archive.open('xb') as output:
        os.chmod(archive, 0o600)
        subprocess.run(['docker', 'cp', f'{name}:/app/data', '-'], check=True, stdout=output)
    print(f'Backup: {archive}')
    return archive


def refresh_helpers(image):
    targets = (
        ('/app/orbitpage-update.py', Path('/usr/local/lib/orbitpage/orbitpage-update.py'), 0o644),
        ('/app/orbitpage-update.sh', Path('/usr/local/bin/orbitpage-update'), 0o755),
    )
    for source, target, mode in targets:
        try:
            result = subprocess.run(['docker', 'run', '--rm', '--entrypoint', 'cat', image, source],
                                    check=True, capture_output=True)
            if source.endswith('.py'):
                compile(result.stdout, source, 'exec')
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temp:
                temp.write(result.stdout)
                temporary = Path(temp.name)
            os.chmod(temporary, mode)
            temporary.replace(target)
        except (OSError, subprocess.CalledProcessError, SyntaxError) as error:
            print(f'Could not refresh {target}: {error}', file=sys.stderr)


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
        super().__init__('localhost')
        self.path = path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
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
    print(f'{name}: pulling {image}')
    run('docker', 'pull', image)
    image_id = docker_json('image', 'inspect', image)[0]['Id']
    if container['Image'] == image_id:
        print(f'{name}: already uses the latest image')
        refresh_helpers(image)
        return
    was_running = container['State']['Running']
    old_name = f'{name}-before-update-{int(time.time())}'
    if was_running:
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
        engine_request('POST', f'/containers/create?name={quote(name)}', payload)
        if was_running:
            engine_request('POST', f'/containers/{quote(name)}/start')
    except Exception:
        if subprocess.run(['docker', 'inspect', name], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, check=False).returncode == 0:
            run('docker', 'rm', '-f', name)
        run('docker', 'rename', old_name, name)
        if was_running:
            run('docker', 'start', name)
        raise
    if was_running:
        verify_container(name, image_id)
    else:
        print(f'{name}: updated; container remains stopped')
    run('docker', 'rm', old_name)
    refresh_helpers(image)


def update_compose(containers):
    command, service = compose_command(containers[0])
    for container in containers:
        image = container['Config']['Image']
        if image.removeprefix('docker.io/') != target_image(image):
            raise RuntimeError(f'Compose image {image!r} is pinned or legacy. Change it to the current :latest image in the Compose file first.')
    print(f'Compose {service}: pulling the configured image')
    run(*command, 'pull', service)
    image_id = docker_json('image', 'inspect', containers[0]['Config']['Image'])[0]['Id']
    if all(container['Image'] == image_id for container in containers):
        print(f'Compose {service}: already uses the latest image')
        refresh_helpers(containers[0]['Config']['Image'])
        return
    try:
        for container in containers:
            if container['State']['Running']:
                run('docker', 'stop', container['Name'].lstrip('/'))
            backup_container(container['Name'].lstrip('/'))
    except Exception:
        run(*command, 'start', service)
        raise
    run(*command, 'up', '-d', '--no-deps', service)
    for container in containers:
        verify_container(container['Name'].lstrip('/'), image_id)
    refresh_helpers(docker_json('inspect', containers[0]['Name'].lstrip('/'))[0]['Config']['Image'])


def update_source(root):
    app = root / 'app'
    if not (root / '.git').exists() or not (app / 'package.json').is_file():
        raise RuntimeError(f'Not an OrbitPage source checkout: {root}')
    owner = root.stat().st_uid
    run('git', '-C', str(root), 'pull', '--ff-only', user=owner)
    run('npm', 'ci', '--prefix', str(app), user=owner)
    run('npm', 'ci', '--prefix', str(app / 'server'), user=owner)
    run('npm', 'run', 'build', '--prefix', str(app), user=owner)
    script = root / 'scripts' / 'orbitpage-update.py'
    if script.is_file():
        destination = Path('/usr/local/lib/orbitpage/orbitpage-update.py')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(script.read_bytes())
        os.chmod(destination, 0o644)
    shell_script = root / 'scripts' / 'orbitpage-update.sh'
    if shell_script.is_file():
        destination = Path('/usr/local/bin/orbitpage-update')
        destination.write_bytes(shell_script.read_bytes())
        os.chmod(destination, 0o755)
    if shutil.which('systemctl') and subprocess.run(['systemctl', 'is-active', '--quiet', 'orbitpage'], check=False).returncode == 0:
        run('systemctl', 'restart', 'orbitpage')
        print('Source updated; orbitpage systemd service restarted.')
    else:
        print('Source updated. Restart the running OrbitPage process to load the new version.')


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run with sudo: sudo orbitpage-update')
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


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        print(f'OrbitPage update failed: {error}', file=sys.stderr)
        sys.exit(1)
