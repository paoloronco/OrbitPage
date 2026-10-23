# Application

The [application README](../../../app/README.md) is the canonical technical guide to the self-hosted codebase. It explains the frontend, backend, shared packages, dependencies, configuration, commands and tests. This page keeps the wiki's existing entry points connected to that guide.

## Stack and request flow

Read [Architecture and request flow](../../../app/README.md#architecture-and-request-flow) for the browser/API/data path and [Dependencies](../../../app/README.md#dependencies-and-configuration-files) for the libraries and tooling. [Architecture](./architecture.md) owns the self-hosted/hosted boundary.

## Repository layout

The [directory map](../../../app/README.md#directory-map) distinguishes application source, shared modules, local helpers and generated output.

## Main files

Start with [Frontend code](../../../app/README.md#frontend-code), [Backend code](../../../app/README.md#backend-code) or [Shared packages](../../../app/README.md#shared-packages). [Where to make changes](../../../app/README.md#where-to-make-changes) maps common tasks to their owners and checks.

## Data and startup

[Data and environment](../../../app/README.md#data-and-environment) explains persistent paths, secrets and startup settings. [Configuration](../administration/Configuration.md) remains the complete environment reference; [Maintenance](../administration/maintenance.md) owns backup and recovery procedures.

## Builds and Docker

See [Builds and Docker](../../../app/README.md#builds-and-docker) for build output and the two Docker contexts. Use [Deployment](../administration/Deployment.md) for installation commands and [GitHub automation](./github-automation.md) for release publication.

## Development and checks

Use [Local setup](../../../app/README.md#local-setup-and-development), the [command reference](../../../app/README.md#commands) and [Tests and scripts](../../../app/README.md#tests-and-scripts). The [development workflow](./Development.md) provides the shell setup; [Contributing](../../../CONTRIBUTING.md) defines the contribution process.
