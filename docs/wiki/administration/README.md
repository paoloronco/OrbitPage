# Administration

Install and operate a self-hosted OrbitPage instance, protect its data and recover access when a service or account fails.

## Install and configure

Choose the source, Docker, Linux or Proxmox procedure in [Deployment](./Deployment.md). Configure persistent storage and the public HTTPS address before sharing a page. [Configuration](./Configuration.md) owns the environment variables and dashboard overrides.

## Protect access and data

Use [Security](./Security.md) for authentication and deployment protections. Give each person their own account and the permissions described in [Account and team](../dashboard/sections/account-and-team.md). Follow [Maintenance](./maintenance.md) to create and verify a full infrastructure backup; a page export alone cannot recover a lost server.

## Update and maintain

Read [Update safely](./Deployment.md#update-safely) before replacing the runtime. Maintenance covers restore, rollback and uninstall. Keep the previous runtime and matching backup until you have checked the updated public page, dashboard and enabled services.

## Diagnose and recover

Start with [Troubleshooting](./Troubleshooting.md) for startup, proxy, upload or indexing failures. Use [Administrator recovery](./recovery.md) only for lost access, and the maintenance restore procedure for lost data. These are different recovery tasks; resetting an account does not restore content.

Return to the [documentation index](../README.md).
