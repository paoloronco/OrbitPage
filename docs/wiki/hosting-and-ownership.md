# Choose hosting and ownership

Compare managed hosting and running OrbitPage yourself: understand ownership, maintenance, security, cost, licences and the work needed to migrate.

<a id="meaning"></a>

## What open source changes

Open source gives you the right to inspect, change and run the software. Managed hosting gives you someone else to operate it. Neither automatically guarantees lower cost, better privacy or greater reliability.

A public repository is only the starting point. The licence determines what you may do with the code. The architecture determines what you need to run it. Maintenance and documentation determine how confidently you can keep it working.

For a public-page tool, open source can make the editor portable, let a team adapt block types or branding, and provide a route away from a hosted provider. Those benefits remain useful when you choose the project's managed service.

<a id="operations"></a>

## Understand the operating work

A small instance can be inexpensive, especially on infrastructure you already operate. Upgrades, backups and incidents still belong to someone even when the server bill is small. Decide who will handle:

1. **Runtime and storage.** Choose where the editor, database and uploaded media live, then define appropriate limits.
2. **Domains and HTTPS.** Configure DNS, certificates, redirects and canonical public addresses.
3. **Identity and security.** Protect administration, manage credentials and apply dependency and operating-system updates.
4. **Backups and recovery.** Keep content, media and configuration recoverable together, and test the procedure.
5. **Monitoring and support.** Detect failed publishes, full disks, delivery errors and content that breaches your operating rules.

<a id="managed"></a>

## Understand managed hosting

A managed service makes accounts, workspace separation, media handling, publishing, upgrades, public delivery and account recovery part of a supported product.

The tradeoff is less control over infrastructure and a recurring fee. Check content export, custom domains, plan limits and downgrade behaviour before choosing a service.

<a id="decision"></a>

## Choose the responsibilities you want to keep

- **Publish quickly or avoid routine maintenance:** managed hosting usually fits when you want to focus on editing and sharing a page.
- **Change the product core:** running the application yourself gives you control over the editor, runtime and deployment.
- **Use existing infrastructure skills:** operating OrbitPage can fit systems and maintenance procedures you already manage.
- **Keep a future exit route:** a public core preserves technical options, while practical migration still depends on content, media, configuration and export compatibility.

<a id="license"></a>

## Read the actual licence

The repository's licence defines use, modification and redistribution conditions. OrbitPage's public core uses the [MIT licence](../../LICENSE.txt); retain the required notices and check the terms of other software and services you use.

A public repository, homepage badge or free download does not replace the licence. Review the actual terms before commercial redistribution and obtain appropriate advice when needed.

<a id="orbitpage"></a>

## Choose an OrbitPage setup path

The public repository contains the MIT-licensed editor, blocks, themes, public renderer and local administration. Managed OrbitPage adds operated accounts, separate workspaces, plan controls, storage, publishing and custom domains.

- [Install with Docker, Linux or Proxmox](./administration/Deployment.md).
- [Run from source](./administration/from-source.md).
- [Start with a managed workspace](https://orbitpage.com/en-US/docs/overview).
- [Review managed hosting](https://orbitpage.com/en-US/hosting) and [current plans](https://orbitpage.com/en-US/pricing).

<a id="questions"></a>

## Settle migration questions before committing

**Is running it yourself always cheaper?** Infrastructure, maintenance time, backups and incident response all have a cost. It is most economical when those responsibilities fit existing systems and skills.

**Is managed hosting less private?** Privacy depends on data practices, providers, analytics, retention and configuration. Operating the software gives you more control and makes you responsible for configuring those systems correctly.

**Can I begin hosted and operate the application later?** The public core preserves that technical route. Check available exports, media portability and custom changes before relying on a migration. A page backup does not automatically transfer accounts, subscriptions or commercial records.

## Related product information

- [Self-hosted link-in-bio overview](https://orbitpage.com/en-US/self-hosted-link-in-bio).
- [Open-source Linktree alternatives](https://orbitpage.com/en-US/open-source-linktree-alternative).
- [OrbitPage as a Linktree alternative](https://orbitpage.com/en-US/linktree-alternative).
- [Compare OrbitPage and LinkStack](https://orbitpage.com/en-US/compare/linkstack).
