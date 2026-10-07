# Troubleshooting

Use the section that matches the symptom. Installation commands are in [Deployment](./Deployment.md).

## Container exits immediately

```bash
docker logs --tail 100 orbitpage
```

Check that the data mount is writable and that an explicit `JWT_SECRET` has at least 32 characters. Docker generates a secret when none is supplied.

For an installer-managed instance, verify the protected environment file and repair with the installer:

```bash
sudo test -s /etc/orbitpage/orbitpage.env
test "$(sudo stat -c '%a' /etc/orbitpage/orbitpage.env)" = '600'
sudo orbitpage install
```

Keep the existing secret and data. Do not replace them to make startup pass.

## Source server rejects JWT_SECRET

The source server does not run Docker's secret-generating entrypoint. Configure a stable `JWT_SECRET` as shown in [Run from source](../../README.md#run-from-source). `NODE_ENV=development` permits a temporary fallback, but a stable key is still needed for persistent TOTP/provider settings.

## Data disappeared after updating

Inspect the mounts:

```bash
docker inspect orbitpage --format '{{json .Mounts}}'
```

The replacement container must use the previous volume/directory at `/app/data`. The repository Compose file uses `./orbitpage-data`; run it from the original project directory. An empty new volume is a different installation.

If data was removed, use [Restore](./maintenance.md#restore-an-infrastructure-backup).

## Login stops working after restart

A changed secret invalidates sessions and can make TOTP or provider credentials unreadable. Restore the previous `.jwt-secret` or explicit host value from its protected backup, recreate the container, and sign in again.

Editing an environment file requires recreation; `docker restart` does not reload it. For a lost password/authenticator, use [Administrator recovery](./recovery.md) instead of rotating `JWT_SECRET`.

## Public page works but dashboard or API fails

Check the HTTPS proxy:

- forward `/api/*` and the dashboard paths;
- do not cache API, dashboard, or health responses;
- forward the public host and protocol;
- set `PUBLIC_SITE_URL` to the public URL, including a mount path;
- configure `ORBITPAGE_TRUST_PROXY` only for the actual proxy address/range.

See [Configuration](./Configuration.md). In source mode, the listener defaults to loopback; a remote proxy needs a reachable listener.

## Public page shows old changes

Save the edited section before checking the public URL. A preview can show unsaved content. Check block visibility/schedules and additional-page publication state, then check any proxy cache.

## Wrong domain in sharing previews or QR

Set `PUBLIC_SITE_URL` and restart or recreate as required. Regenerate QR images using the correct destination and refresh the social service's cached preview.

## A staging page is indexed

Set `SEO_INDEXING=false`, then check `/robots.txt` and the page's robots meta tag. Search engines may take time to refresh their copy. Indexing controls do not restrict access.

## Image pull or dashboard installation fails

Use `paoloronco/orbitpage:latest` or `ghcr.io/paoloronco/orbitpage:latest`. For a pinned release, use a complete published version without a leading `v`.

Dashboard installation needs the [host update service](./Deployment.md#web-updates). If unavailable, follow the dialog's terminal instructions. Inspect the service and retained backup before retrying an update with an unknown result.

## Ports

| Mode | Default |
| --- | --- |
| Vite frontend | `8080` |
| Source Express server | `3001` |
| Docker | `8080` |

Stop a conflicting process or change the listener/port mapping. Use [Development](./Development.md) for the two-server workflow.

Before posting logs or screenshots, remove secrets and private page/account data.
