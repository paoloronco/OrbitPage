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
    const frontendPackage = JSON.parse(read('app/package.json'));
    const backendPackage = JSON.parse(read('app/server/package.json'));
    const rootDockerfile = read('Dockerfile');
    const appDockerfile = read('app/Dockerfile');

    expect(backendPackage.version).toBe(frontendPackage.version);
    expect(rootDockerfile).toContain(`org.opencontainers.image.version="${frontendPackage.version}"`);
    expect(appDockerfile).toContain(`org.opencontainers.image.version="${frontendPackage.version}"`);
  });

  it('keeps both Dockerfiles aligned on production startup requirements', () => {
    const rootDockerfile = read('Dockerfile');
    const appDockerfile = read('app/Dockerfile');

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

  it('keeps extracted server modules available in the root Docker image', () => {
    const rootDockerfile = read('Dockerfile');

    expect(rootDockerfile).toContain('COPY app/server/schemas ./schemas');
    expect(rootDockerfile).toContain('COPY app/server/services ./services');
  });

  it('creates releases only from an exact version tag after the main CI succeeds', () => {
    const workflow = read('.github/workflows/release.yml');

    expect(workflow).toContain('tags: ["v*.*.*"]');
    expect(workflow).not.toContain('branches: ["main"]');
    expect(workflow).toContain("require('./app/package.json').version");
    expect(workflow).toContain("require('./app/server/package.json').version");
    expect(workflow).toContain('EXPECTED_TAG="v${VERSION}"');
    expect(workflow).toContain('git merge-base --is-ancestor "${RELEASE_SHA}" origin/main');
    expect(workflow).toContain('"E2E (webkit)"');
    expect(workflow).toContain('"Build and smoke Docker (amd64)"');
    expect(workflow).toContain('"Build and smoke Docker (arm64)"');
    expect(workflow).toContain('gh release create "$TAG"');
    expect(workflow).not.toContain('git push origin "$TAG"');
  });

  it('publishes Docker images to both Docker Hub and GitHub Container Registry', () => {
    const workflow = read('.github/workflows/release.yml');

    expect(workflow).toContain('DOCKERHUB_IMAGE: docker.io/paoloronco/orbitpage');
    expect(workflow).toContain('LEGACY_DOCKERHUB_IMAGE: docker.io/paueron/orbitpage');
    expect(workflow).toContain('LEGACY_DOCKERHUB_CUTOFF: "2026-10-09T00:00:00Z"');
    expect(workflow).toContain('GHCR_IMAGE: ghcr.io/paoloronco/orbitpage');
    expect(workflow).toContain('packages: write');
    expect(workflow).toContain('registry: ghcr.io');
    expect(workflow).toContain('username: ${{ github.actor }}');
    expect(workflow).toContain('password: ${{ github.token }}');
  });

  it('publishes only latest and complete version Docker tags', () => {
    const workflow = read('.github/workflows/release.yml');
    const publishedTags = workflow
      .match(/^\s+\$\{\{ env\.(?:DOCKERHUB_IMAGE|GHCR_IMAGE|LEGACY_DOCKERHUB_IMAGE) \}\}:[^\r\n]+/gm)
      ?.map((tag) => tag.trim());

    expect(publishedTags).toEqual([
      '${{ env.DOCKERHUB_IMAGE }}:${{ needs.validate.outputs.version }}',
      '${{ env.DOCKERHUB_IMAGE }}:latest',
      '${{ env.GHCR_IMAGE }}:${{ needs.validate.outputs.version }}',
      '${{ env.GHCR_IMAGE }}:latest',
      '${{ env.LEGACY_DOCKERHUB_IMAGE }}:${{ needs.validate.outputs.version }}',
      '${{ env.LEGACY_DOCKERHUB_IMAGE }}:latest',
    ]);
  });

  it('runs a blocking CI quality gate for pull requests and main pushes', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('branches: [ "main" ]');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm run test:unit');
    expect(workflow).toContain('npm audit --audit-level=high');
    expect(workflow).toContain('npm --prefix server audit --audit-level=high');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('docker build -t orbitpage-ci-smoke ..');
    expect(workflow).toContain('curl --fail http://127.0.0.1:3001/health');
  });

  it('tests native Docker architectures on main without publishing registry tags', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain('needs: [test, e2e]');
    expect(workflow).toContain('runner: ubuntu-24.04');
    expect(workflow).toContain('runner: ubuntu-24.04-arm');
    expect(workflow).toContain('platform: linux/amd64');
    expect(workflow).toContain('platform: linux/arm64');
    expect(workflow).toContain('load: true');
    expect(workflow).toContain('Smoke test architecture image');
    expect(workflow).not.toContain('docker.io/paoloronco/orbitpage');
    expect(workflow).not.toContain('ghcr.io/paoloronco/orbitpage');
  });

  it('builds the frontend before server tests that exercise SPA rendering', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow.indexOf('npm run build')).toBeLessThan(workflow.indexOf('npm run test:unit'));
  });

  it('keeps read-only GitHub token permissions on workflows that only need checkout', () => {
    const ciWorkflow = read('.github/workflows/ci.yml');
    const mirrorWorkflow = read('.github/workflows/gitea-mirror.yml');

    for (const workflow of [ciWorkflow, mirrorWorkflow]) {
      expect(workflow).toContain('permissions:');
      expect(workflow).toContain('contents: read');
    }
  });
});
