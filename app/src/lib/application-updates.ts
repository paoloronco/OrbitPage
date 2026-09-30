export async function checkApplicationUpdate(currentVersion: string) {
  const response = await fetch('https://api.github.com/repos/paoloronco/OrbitPage/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Update check unavailable.');
  const release: unknown = await response.json();
  if (!release || typeof release !== 'object' || !('tag_name' in release)
    || !('draft' in release) || release.draft !== false
    || !('prerelease' in release) || release.prerelease !== false) {
    throw new Error('Invalid stable release.');
  }
  const stableVersion = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const latest = typeof release.tag_name === 'string' ? stableVersion.exec(release.tag_name)?.slice(1) : null;
  const installed = stableVersion.exec(currentVersion)?.slice(1);
  if (!latest || !installed || ![...latest, ...installed].every(part => Number.isSafeInteger(Number(part)))) {
    throw new Error('Invalid application version.');
  }
  const difference = latest.map((part, index) => Number(part) - Number(installed[index])).find(value => value !== 0) || 0;
  const version = latest.join('.');
  return {
    version,
    updateAvailable: difference > 0,
    releaseUrl: `https://github.com/paoloronco/OrbitPage/releases/tag/v${version}`,
  };
}
