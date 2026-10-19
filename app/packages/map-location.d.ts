export type MapCoordinates = { lat: number; lon: number };
export function toMapCoordinates(latitude?: unknown, longitude?: unknown): MapCoordinates | null;
export function extractMapCoordinates(value?: string): MapCoordinates | null;
export function getMapUrlQuery(value?: string): string;
export function normalizeSupportedMapUrl(value?: string): URL | null;
export function getMapPreviewUrl(mapUrl?: string, query?: string, coordinates?: MapCoordinates | null): string;
