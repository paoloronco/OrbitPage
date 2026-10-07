# Backups, media, and demo mode

Use dashboard exports to move selected content. Back up the complete data directory and host configuration to recover an installation.

| Backup layer | Best use | What it contains |
| --- | --- | --- |
| Dashboard JSON or portable ZIP | Selective transfer, inspection, and application-level restore | The selected sections; the optional ZIP also contains images |
| Infrastructure backup | Full disaster recovery | `orbitpage.db`, `uploads/`, and the deployment configuration needed to start the same instance |

Follow the [infrastructure backup and restore runbook](./maintenance.md#create-and-verify-an-infrastructure-backup) for production recovery.

## Export a dashboard backup

1. Open **Dashboard > Backup** with an administrator account.
2. Select the sections you need.
3. Leave **Include images (ZIP)** unchecked for the default JSON download, or select it to move images with the backup. The option is hidden when no images are available.
4. Select **Download selected**.
5. Store the file outside the OrbitPage host and record which instance and version produced it.
6. Confirm that a JSON download opens as JSON or that a ZIP contains `backup.json` and `uploads/`. Do not edit either format by hand.

The self-hosted backup sections are:

| Section | Contents |
| --- | --- |
| Profile and page | Identity, social links, browser metadata, and profile appearance |
| Blocks and links | Home content, order, visibility, scheduling, counters, and block settings |
| Subpages | Slugs, page descriptions, publication state, and subpage blocks |
| Theme and appearance | Shared colors, typography, card system, layout, and background |
| Menu | Menu identity, categories, items, prices, and independent appearance |
| Privacy and consent | Cookie banner, policies, consent mode, and provider settings |
| Discovery files | Sitemap state and built-in or custom text files |
| Admin accounts | Self-hosted users, roles, and stored credential records |

A complete JSON export includes every selectable data section. A selective export declares only the selected sections and leaves the rest out. Images are separate from section selection: enabling **Include images (ZIP)** creates an archive that both OrbitPage OSS and SaaS can restore. Videos remain excluded from this image archive.

Keep exports private: they may contain page data, analytics, account hashes, and uploaded images. AI keys and newsletter/SMTP records are excluded; preserve them through an infrastructure backup.

Managed OrbitPage SaaS backups with schema versions 1–3 can also be opened here. OrbitPage restores the supported page, block, subpage, theme, menu, privacy, and discovery data into the self-hosted schema. SaaS-only data such as tenants, plans, billing, managed accounts, and custom-domain state is not imported. For a transfer that must retain images, download the portable ZIP at the source and open that ZIP at the destination.

## Restore a recent local version

**Dashboard > Backup > Version history** keeps the latest 25 page snapshots in the instance's local SQLite database. OrbitPage records the current state before page, block, smart-campaign, theme, menu, subpage, privacy, or discovery changes and captures the current revision when version history is opened. Restoring a snapshot creates a new current revision instead of overwriting history in place.

These snapshots stay only in the instance's `DATA_DIR/orbitpage.db`; they are not uploaded to OrbitPage SaaS or another service. They are convenient for undoing an edit, but they are not a disaster-recovery backup because losing the database also loses the history.

## Restore selected sections

Restoring is a replacement operation for the selected sections, not a merge.

1. Create and verify an infrastructure backup of the current `DATA_DIR`.
2. Open **Dashboard > Backup** and select **Open backup file**.
3. Review the detected source and available sections.
4. Select only the sections that should replace current data.
5. Confirm the section list and wait for the dashboard to reload.
6. Sign in again if account records were restored.
7. Check the public profile, Home blocks, subpages, menu, theme, legal routes, and uploaded media that were in scope.

Sections left unchecked remain unchanged. A portable ZIP exposes **Uploaded media** during restore; selecting it replaces the current uploads directory with the images in the archive. Selecting **Admin accounts** replaces the current local account records and can invalidate the active session.

Restore only trusted files: they can replace public content and accounts. If restoration or verification fails, stop editing and recover from the pre-change infrastructure backup.

## Export only the main-page blocks

The download and upload icons in **Content** operate only on the main-page block list. Importing `links-export.json` replaces that list and does not restore profile, theme, menu, subpages, privacy settings, accounts, or uploaded-file contents.

Use this small format to move a block layout between trusted instances. Use **Backup** when the destination also needs referenced media or other application sections.

## Clean unused media

Removing an image or video from the editor removes its database reference but does not immediately delete the file. OrbitPage protects referenced files, files referenced by retained local versions, and recent unreferenced uploads during cleanup.

1. Create a verified infrastructure backup. Optionally download an image ZIP for application-level recovery; it does not contain videos.
2. Select **Check unused media** to run a dry inspection.
3. Review the scanned, protected, unused, and reclaimable-space totals.
4. Select **Clean now** only when the unused count is expected.
5. Reload the public page and check images, video blocks, menu images, and the background.

Cleanup deletes files from storage and cannot be undone in the dashboard. Recovery requires a backup. The grace period and automatic cleanup can be configured with `MEDIA_CLEANUP_ENABLED` and `MEDIA_CLEANUP_GRACE_HOURS`; see [Configuration](./Configuration.md).

## Demo mode

Demo mode is part of the self-hosted application, but it is intended only for a disposable evaluation instance. It takes an initial snapshot of the application tables and uploads, then restores that state every five minutes.

Assume that every change made in demo mode will be lost. Some editing actions can be explored temporarily, while high-risk or misleading actions are disabled, including backup restore, media cleanup, password and recovery changes, AI changes, menu and subpage changes, privacy configuration, sitemap generation, and discovery-file edits. The interface marks unavailable controls and keeps a persistent demo notice visible.

Demo mode uses fixed public policy pages and keeps OrbitPage attribution visible. Enable it only with disposable data.

The server and frontend demo settings must describe the same deployment. Use the [Configuration reference](./Configuration.md) for `DEMO_MODE` and `VITE_DEMO_MODE`, then verify the reset with disposable content before making the instance reachable by others.
