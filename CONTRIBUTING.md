# Contributing to OrbitPage

Thanks for helping improve OrbitPage. This guide keeps the local setup, checks, and contribution flow aligned with the current repository structure.

## Project Layout

Application code lives under `app/`.

```text
app/
  src/      React frontend (Vite + TypeScript)
  server/   Express backend (Node.js + SQLite)
  public/   Static assets copied into the frontend build
  dist/     Generated frontend build output
```

Repository-level files contain Docker, CI, release, and documentation configuration.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- Git
- Docker, only when testing container builds

## Local Setup

```bash
git clone https://github.com/paoloronco/OrbitPage.git
cd OrbitPage/app
npm ci
npm run install:server
```

Production-style local run:

```bash
npm run start
```

Open:

- Public page: http://localhost:3001
- Admin panel: http://localhost:3001/admin
- Health check: http://localhost:3001/health

The first admin visit asks you to create credentials. The initial username is `admin`.

## Development Mode

Development uses two processes.

Terminal 1:

```bash
cd OrbitPage/app
npm run server:dev
```

Terminal 2:

```bash
cd OrbitPage/app
npm run dev
```

Open:

- Frontend: http://localhost:8080
- Admin panel: http://localhost:8080/admin
- Backend health check: http://localhost:3001/health

## Checks

Run these before opening a pull request:

```bash
cd OrbitPage/app
npm run lint
npm run test:unit
npm run build
```

For browser coverage:

```bash
npm run test:e2e
```

The repository may contain existing ESLint warnings. New changes should avoid adding warnings or errors.

## How to Contribute

1. Search existing issues or discussions before starting larger work.
2. Fork the repository.
3. Create a focused branch from `main`.
4. Keep the change scoped to one bug fix, feature, or documentation improvement.
5. Add or update tests when behavior changes.
6. Update documentation when commands, configuration, or user-visible behavior changes.
7. Run the checks listed above.
8. Open a pull request with a clear summary and verification notes.

Branch examples:

```bash
git checkout -b feat/theme-presets
git checkout -b fix/docker-healthcheck
git checkout -b docs/deployment-guide
```

## Commit Messages

Use this format:

```text
type(scope): description
```

Common types:

- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting or visual polish
- `refactor`: code restructuring without behavior changes
- `test`: test additions or updates
- `chore`: maintenance
- `ci`: CI/CD and workflow changes

Examples:

```bash
feat(theme): add preset export
fix(auth): handle expired admin sessions
docs(readme): clarify docker deployment
ci(release): publish versioned github releases
```

## Coding Guidelines

- Follow existing patterns before introducing new abstractions.
- Use TypeScript types for new frontend code.
- Avoid `any` unless a boundary genuinely cannot be typed.
- Keep React components functional and hook-based.
- Use existing shadcn/ui and local UI patterns.
- Keep public links as real `<a href="...">` elements where possible.
- Validate input on the server, even when the frontend already validates it.
- Use parameterized database helpers instead of string-built SQL.
- Keep migrations additive and backward compatible.

## Backend and Data

OrbitPage uses SQLite through `app/server/database.js`.

- Local data defaults to `app/server/orbitpage.db`.
- Docker data belongs in `/app/data`.
- Uploads are stored under `DATA_DIR/uploads`.
- Schema changes should be additive so existing installs can start after an upgrade.

## Security Guidelines

- Never commit secrets, tokens, private keys, or real production data.
- Do not expose sensitive values to frontend code.
- Keep `JWT_SECRET` stable and private in production.
- Use `RESET_TOKEN` only when recovery endpoints are needed.
- Report vulnerabilities privately through the process in [SECURITY.md](./SECURITY.md).

## Pull Request Checklist

- [ ] The change is focused and easy to review.
- [ ] Documentation is updated when needed.
- [ ] Tests are added or updated for behavior changes.
- [ ] `npm run lint` has been run from `app/`.
- [ ] `npm run test:unit` has been run from `app/`.
- [ ] `npm run build` has been run from `app/`.
- [ ] E2E tests are run or explicitly called out as not applicable.

## Release Notes

Maintainers handle version bumps, tags, GitHub releases, and published Docker images. Pull requests should describe user-visible changes clearly so release notes can be written without archaeology.

## License

By contributing to OrbitPage, you agree that your contribution will be licensed under the MIT License in [LICENSE.txt](./LICENSE.txt).
