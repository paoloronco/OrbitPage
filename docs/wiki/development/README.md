# Development

Find the source, contracts, local checks and contribution workflow for changes to the shared OrbitPage editor and self-hosted application.

## Understand the change

Start with [Product requirements](./product-requirements.md) for expected behavior, then [Application](./application.md) for the repository map. [Architecture](./architecture.md) explains runtime ownership and the boundary between the public application and managed hosting.

## Run and test locally

Follow [Development workflow](./Development.md) to install dependencies, run the frontend and API, and select the relevant checks. Use disposable local data for testing; never use a real customer's database or upload directory as a fixture.

## Use the right contract

[Self-hosted API](./api.md) describes the dashboard's authentication boundary. It is not the managed service's versioned Automation API. For interface changes, follow [Design system](./design-system.md) so keyboard behavior, responsive layouts and component styles remain consistent.

## Contribute and release

Use [Contributing](../../../CONTRIBUTING.md) for the review workflow and [GitHub automation](./github-automation.md) for CI, releases and mirrors. Update the guide that owns changed behavior instead of adding a second explanation elsewhere.

Return to the [documentation index](../README.md).
