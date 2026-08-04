export const isHostedRuntime = (): boolean =>
  import.meta.env.VITE_ORBITPAGE_HOSTED_MODE === 'true' ||
  import.meta.env.VITE_ORBITPAGE_HOSTED_MODE === '1';
