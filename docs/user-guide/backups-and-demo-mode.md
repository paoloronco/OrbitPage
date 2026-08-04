# Backups, media, and demo mode

OrbitPage provides a portable JSON backup in the dashboard, but production recovery still requires a consistent copy of the complete `DATA_DIR`. Use both layers.

| Backup layer | Best use | What it contains |
| --- | --- | --- |
| Dashboard JSON | Selective transfer, inspection, and application-level restore | The sections selected in **Dashboard > Backup**, with uploaded files embedded when Media is selected |
| Infrastructure backup | Full disaster recovery | `orbitpage.db`, `uploads/`, and the deployment configuration needed to start the same instance |

Follow the [infrastructure backup and restore runbook](../wiki/Deployment.md#create-and-verify-an-infrastructure-backup) for production recovery. A downloaded JSON file does not prove that the persistent volume, reverse proxy, or runtime configuration can be restored.

## Export a dashboard backup

1. Open **Dashboard > Backup** with an administrator account.
2. Select the sections you need.
3. Select **Download selected**.
4. Store the file outside the OrbitPage host and record which instance and version produced it.
5. Confirm the downloaded file can be opened as JSON. Do not edit it by hand.

The self-hosted backup sections are:

| Section | Contents |
| --- | --- |
| Profile and page | Identity, social links, browser metadata, and profile appearance |
| Blocks and links | Home content, order, visibility, scheduling, counters, and block settings |
| Subpages | Slugs, page descriptions, publication state, and subpage blocks |
| Theme and appearance | Shared colors, typography, card system, layout, and background |
| Venue menu | Menu identity, categories, items, prices, and independent appearance |
| Privacy and consent | Cookie banner, policies, consent mode, and provider settings |
| Discovery files | Sitemap state and built-in or custom text files |
| Admin accounts | Self-hosted users, roles, and stored credential records |
| Uploaded media | Files stored under `DATA_DIR/uploads`, encoded into the JSON file |

A complete export includes every section. A selective export declares only the selected sections and leaves the rest out.

Treat every backup as sensitive. It can contain personal content, analytics counters, policy configuration, credential hashes, and the original uploaded files. The self-hosted AI provider key is intentionally excluded, but that does not make the backup safe to share.

## Restore selected sections

Restoring is a replacement operation for the selected sections, not a merge.

1. Create and verify an infrastructure backup of the current `DATA_DIR`.
2. Open **Dashboard > Backup** and select **Open backup file**.
3. Review the detected source and available sections.
4. Select only the sections that should replace current data.
5. Confirm the section list and wait for the dashboard to reload.
6. Sign in again if account records were restored.
7. Check the public profile, Home blocks, subpages, menu, theme, legal routes, and uploaded media that were in scope.

Sections left unchecked remain unchanged. Selecting **Uploaded media** replaces the current uploads directory with the files in the backup. Selecting **Admin accounts** replaces the current local account records and can invalidate the active session.

Never restore a file from an untrusted source. OrbitPage validates the format and paths, but a restore still changes public content and authentication data by design. If validation or the post-restore checks fail, stop editing and restore the pre-change infrastructure backup.

## Home-block export is different

The download and upload icons in **Content > Home** operate only on the main-page block list. Importing `links-export.json` replaces that list and does not restore profile, theme, menu, subpages, privacy settings, accounts, or uploaded-file contents.

Use this small format to move a block layout between trusted instances. Use **Backup** when the destination also needs referenced media or other application sections.

## Clean unused media

Removing an image or video from the editor removes its database reference but does not immediately delete the file. OrbitPage protects referenced files and recent unreferenced uploads during cleanup.

1. Create a backup that includes Uploaded media.
2. Select **Check unused media** to run a dry inspection.
3. Review the scanned, protected, unused, and reclaimable-space totals.
4. Select **Clean now** only when the unused count is expected.
5. Reload the public page and check images, video blocks, menu images, and the background.

Cleanup deletes files from storage and cannot be undone in the dashboard. Recovery requires a backup. The grace period and automatic cleanup can be configured with `MEDIA_CLEANUP_ENABLED` and `MEDIA_CLEANUP_GRACE_HOURS`; see [Configuration](../wiki/Configuration.md).

## Demo mode

Demo mode is part of the self-hosted application, but it is intended only for a disposable evaluation instance. It takes an initial snapshot of the application tables and uploads, then restores that state every five minutes.

Assume that every change made in demo mode will be lost. Some editing actions can be explored temporarily, while high-risk or misleading actions are disabled, including backup restore, media cleanup, password and recovery changes, AI changes, menu and subpage changes, privacy configuration, sitemap generation, and discovery-file edits. The interface marks unavailable controls and keeps a persistent demo notice visible.

Demo mode also fixes the public legal-policy routes and keeps OrbitPage attribution visible. It is not an access-control system, a staging strategy, or a substitute for backups. Do not enable it on an instance that contains durable user data.

The server and frontend demo settings must describe the same deployment. Use the [Configuration reference](../wiki/Configuration.md) for `DEMO_MODE` and `VITE_DEMO_MODE`, then verify the reset with disposable content before making the instance reachable by others.
