# OrbitPage documentation

The [wiki index](./wiki/README.md) is the complete, task-oriented guide to the open-source, self-hosted application. Start there to install, use, maintain or develop OrbitPage.

For the managed service, use [OrbitPage's online documentation](https://orbitpage.com/en-US/docs). Installation commands and owner-managed credentials in this repository apply to self-hosted OrbitPage.

<a id="documentation"></a>
<a id="install-orbitpage"></a>
<a id="update-orbitpage"></a>
<a id="using-orbitpage"></a>
<a id="integrations"></a>
<a id="administration"></a>
<a id="development-and-architecture"></a>
<a id="common-paths"></a>
<a id="new-installation"></a>
<a id="existing-installation"></a>

## Choose a starting point

| What you want to do | Start here |
| --- | --- |
| Install your first instance | [Deployment](./wiki/administration/Deployment.md) or [Run from source](./wiki/administration/from-source.md) |
| Choose hosting and plan a page | [Hosting and ownership](./wiki/hosting-and-ownership.md), then [Page planning](./wiki/page-planning.md) |
| Edit, save and share your page | [Dashboard](./wiki/dashboard/README.md) |
| Build a page for a specific project or business | [Examples and use cases](./wiki/README.md#examples-and-use-cases) |
| Connect email, payments, forms or embedded services | [Integrations](./wiki/integrations/README.md) |
| Update, back up or recover an installation | [Administration](./wiki/administration/README.md) |
| Diagnose a problem | [Troubleshooting](./wiki/administration/Troubleshooting.md) and [Frequently asked questions](./wiki/faq.md) |
| Change application code or write an integration | [Development](./wiki/development/README.md) and [Contributing](../CONTRIBUTING.md) |

<a id="additional-resources"></a>

## Folder map and document ownership

| Location | What belongs here |
| --- | --- |
| [wiki/README.md](./wiki/README.md) | Complete guide index, organized by reader task |
| [wiki/administration/](./wiki/administration/README.md) | Installation, configuration, updates, backups, security and recovery |
| [wiki/dashboard/](./wiki/dashboard/README.md) | Dashboard navigation; individual editing tasks live in `sections/` |
| [wiki/integrations/](./wiki/integrations/README.md) | Provider setup, SMTP, payments, embeds and consent |
| [wiki/use-cases/](./wiki/use-cases/) | Practical page-building examples, linked from the wiki index |
| [wiki/development/](./wiki/development/README.md) | Product contracts, architecture, design, API boundaries and contributor workflows |
| [screenshots/](./screenshots/README.md) | Screenshot provenance and published documentation media |
| [brand/](./brand/) | Approved project artwork and exports; usage rules are in the [design system](./wiki/development/design-system.md#brand) |
| [Development maintenance](./wiki/development/repository-maintenance.md) | Maintainer review criteria and maintenance backlog |

The repository [README](../README.md) owns the product overview and quick start. The [application README](../app/README.md) maps source code and commands; [Scripts](../scripts/README.md) explains installer, updater and verification helpers. Security reporting follows [SECURITY.md](../SECURITY.md).

Root-level wiki compatibility pages retain earlier links. Follow their links to the canonical guide rather than adding instructions to the compatibility page.

<a id="contributor"></a>
<a id="need-help"></a>

## Read, contribute and get help

Guides are written in English. Dashboard language settings translate interface controls, not saved page content or these source files.

For a bug, include the version, installation method, failing step and a sanitized error in a [GitHub issue](https://github.com/paoloronco/OrbitPage/issues). Report security vulnerabilities privately through [SECURITY.md](../SECURITY.md); keep credentials, databases and customer data out of public reports.

To improve a guide, follow [Documentation changes](../CONTRIBUTING.md#documentation-changes). Link to the existing explanation when it already covers the task, and update the wiki index whenever a guide is added or moved.
