# Run from source

Build and run the self-hosted application with Node.js instead of a container. You manage the process, persistent data, HTTPS and updates. For a container or an installer-managed service, use [Deployment](./Deployment.md).

## Requirements

- Git and npm.
- A supported Node.js release: `^22.23.4`, `^24.22.1` or `^26.12.1`, as declared in the application and server packages.
- A writable local directory for SQLite and uploads. Do not share one database between several application processes.

If dependency installation cannot use a prebuilt SQLite module, install the native build tools required by your operating system and retry. Run the application as an unprivileged user with access to its data directory.

## Download and install

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
```

For a reproducible installation, select a reviewed release tag before installing dependencies. Keep local changes separate when updating an existing checkout.

## Configure the environment

Create `app/.env` once and generate a private, stable `JWT_SECRET` before the first start. Choose the commands for your shell; do not repeat them on each restart or overwrite an existing environment file.

### Linux, macOS or a POSIX shell

Run from `OrbitPage/app`:

```bash
cp .env.example .env
chmod 600 .env
printf '\nJWT_SECRET=%s\n' "$(node -p "require('crypto').randomBytes(32).toString('hex')")" >> .env
```

### Windows PowerShell

Run from `OrbitPage/app`:

```powershell
Copy-Item .env.example .env
$orbitpageSecret = node -p "require('crypto').randomBytes(32).toString('hex')"
Add-Content -LiteralPath .env -Value "`nJWT_SECRET=$orbitpageSecret" -Encoding utf8
Remove-Variable orbitpageSecret
```

Restrict access to `.env` to the account running the service. Keep the file and its backups out of Git.

The example uses `NODE_ENV=production`, `PORT=8080`, `HOST=127.0.0.1` and `PUBLIC_SITE_URL=http://localhost:8080`. Set an absolute `DATA_DIR` outside the source checkout when keeping service data separately. Without it, data defaults to `app/server`; relative data paths resolve from that working directory.

Keep `JWT_SECRET` and any explicit encryption-key overrides stable across restarts, rebuilds and updates. Optional AI, SMTP and payment services can be configured separately; they are not prerequisites for editing an ordinary page. See [Configuration](./Configuration.md) for the full settings catalog.

## Build and start

Run from `OrbitPage/app`:

```bash
npm run build
cd server
node --env-file=../.env server.js
```

The backend serves the built frontend from `app/dist` and loads `app/.env` before initialization. Running `npm run start` alone does not load that environment file into the backend.

On the same computer, open:

| Purpose | Address |
| --- | --- |
| First administrator setup and dashboard | <http://localhost:8080/dashboard/profile> |
| Public page | <http://localhost:8080> |
| Health check | <http://localhost:8080/health> |

Choose the administrator password before making the instance reachable by other people. Keep the terminal running for this foreground session; Ctrl+C stops it. To run continuously or survive a reboot, configure your operating system's service manager or process supervisor to run the same command from `app/server`, with the same environment file and data directory.

## Publish safely

Keep loopback access when a reverse proxy runs on the same machine. For LAN access, explicitly set `HOST=0.0.0.0` and restrict access at the network boundary. Configure the real `PUBLIC_SITE_URL`, reverse proxy and HTTPS before public use; follow [Reverse proxy and HTTPS](./Deployment.md#reverse-proxy-and-https).

Check the public page, dashboard login, uploads and `/health` after changing the address. Configure backups of the data directory and the private environment file before accepting real content. See [Maintenance](./maintenance.md).

## Update a source installation

1. Read the release notes and retain the previous revision.
2. Stop the application and create a verified backup of its database, uploads, private settings and stable secrets.
3. Update the source to the reviewed revision, preserving any local changes.
4. From `app`, run `npm ci`, `npm run install:server` and `npm run build`.
5. Restart from `app/server` with `node --env-file=../.env server.js`, using the original environment file and data directory.
6. Verify `/health`, administrator login, the public page and uploaded media before discarding recovery copies.

Source installations use operator-controlled updates; the Docker update agent does not manage this process. Follow [Maintenance](./maintenance.md) for restore and rollback and [Source troubleshooting](./Troubleshooting.md#source-installation) for startup problems.

## Develop with live reload

The production-style run above serves the built frontend. To change application code with Vite and a separate backend, follow [Development workflow](../development/Development.md#run-with-live-reload), using disposable development data.
