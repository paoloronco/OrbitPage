import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../../..');

const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('deployment configuration', () => {
  it('keeps package, Docker image labels, and runtime version in sync', () => {
    const frontendPackage = JSON.parse(read('LYNX/package.json'));
    const backendPackage = JSON.parse(read('LYNX/server/package.json'));
    const rootDockerfile = read('Dockerfile');
    const appDockerfile = read('LYNX/Dockerfile');

    expect(backendPackage.version).toBe(frontendPackage.version);
    expect(rootDockerfile).toContain(`org.opencontainers.image.version="${frontendPackage.version}"`);
    expect(appDockerfile).toContain(`org.opencontainers.image.version="${frontendPackage.version}"`);
  });

  it('keeps both Dockerfiles aligned on production startup requirements', () => {
    const rootDockerfile = read('Dockerfile');
    const appDockerfile = read('LYNX/Dockerfile');

    for (const dockerfile of [rootDockerfile, appDockerfile]) {
      expect(dockerfile).toContain('FROM node:22-alpine AS builder');
      expect(dockerfile).toContain('FROM node:22-alpine');
      expect(dockerfile).toContain('COPY docker-entrypoint.sh /app/server/docker-entrypoint.sh');
      expect(dockerfile).toContain('ENTRYPOINT ["./docker-entrypoint.sh"]');
      expect(dockerfile).toContain('ENV PORT=8080');
      expect(dockerfile).toContain('ENV DATA_DIR=/app/data');
      expect(dockerfile).toContain('EXPOSE 8080 8443');
    }
  });

  it('creates GitHub releases from the package version tag on main pushes', () => {
    const workflow = read('.github/workflows/release.yml');

    expect(workflow).toContain('branches: [ "main" ]');
    expect(workflow).toContain("require('./LYNX/package.json').version");
    expect(workflow).toContain("require('./LYNX/server/package.json').version");
    expect(workflow).toContain('TAG="v${VERSION}"');
    expect(workflow).toContain('gh release create "$TAG"');
  });
});
