export type MapPreviewResolution = {
  lat?: string;
  lon?: string;
  resolvedUrl?: string;
  displayName: string;
  source: 'coordinates' | 'redirect' | 'embed' | 'geocoding';
};
export function resolveMapPreview(input: { query?: string; mapUrl?: string }): Promise<MapPreviewResolution>;
