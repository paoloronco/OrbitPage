# Frequently asked questions

Find answers about OrbitPage setup, instance checks, email, payments and booking webhooks, with links to the relevant operating guides.

## Do I need a managed OrbitPage account or paid plan?

No. The MIT-licensed self-hosted application runs with local accounts on your own infrastructure. You operate storage, updates, backups and the public address. Optional AI, email and payment providers can have their own charges; see [Hosting and ownership](./hosting-and-ownership.md).

## When do my edits become public?

Save each changed dashboard section, then open the public address to check it. The preview may contain unsaved changes. Additional pages must be published; Menu and Shop have their own publication controls. See [Save and preview](./dashboard/README.md#save-and-preview) and [Publishing](./dashboard/sections/publishing.md).

## What do I need for a complete backup?

Keep the whole persistent data directory together with the original signing/encryption secrets and deployment configuration. Dashboard exports move selected content and do not replace that infrastructure backup. Follow [Backups and maintenance](./administration/maintenance.md) and test recovery on an isolated instance.

## Where can I check whether my instance is working?

Open **Shop settings → INFO** as the installation administrator. Refresh checks SQLite
integrity, data/upload access, free disk space, application build, runtime support, server
dependencies, private-data permissions, HTTPS, session-secret configuration and
security headers. Failed or unavailable checks are shown explicitly.

The dependency audit sends the names and versions of production dependencies
from the frontend and server lockfiles to the public npm advisory service.
It sends no credentials or page/customer content. Results are cached for 15
minutes; failed requests are cached for one minute. The panel shows the audit
timestamp. Offline installations report this check as **Not verified**.
See [npm's audit protocol](https://docs.npmjs.com/cli/v8/commands/npm-audit/).

These checks do not replace a host/security audit, backup restore test or
verification of external services. Windows ACLs require a manual check.
See [Security](./administration/Security.md) and [Maintenance](./administration/maintenance.md).

## Why is Publish shop disabled?

Complete and save Compliance, verify Stripe and its webhook, send a successful
Shop SMTP test and make a complete product available. Hover over the button to
see what is missing. **Unpublish** remains available if setup becomes incomplete.
See [Shop](./dashboard/sections/shop.md#publish-or-unpublish).

## Can OSS send email through OrbitPage?

Self-hosted Shop and Newsletter use your SMTP provider. Configure and test it
using [SMTP email setup](./integrations/smtp.md). The managed OrbitPage email
option belongs to SaaS Shop.

## Why is my calendar webhook not verified?

A saved service booking link confirms that a calendar is configured. Webhook
verification requires OrbitPage to receive a valid signed booking event.
Generating a webhook URL alone does not confirm that it is installed in Cal.com.
See [Shop calendar setup](./dashboard/sections/shop.md#calendar).

## How do I update or fix a failing check?

Follow [Updates](./administration/Deployment.md#update-safely) and
[Troubleshooting](./administration/Troubleshooting.md). Back up persistent data
before updating. Share version, check name and sanitized errors when requesting
help; keep passwords, provider keys and signed customer links private.
