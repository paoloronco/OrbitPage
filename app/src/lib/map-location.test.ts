import { describe, expect, it } from 'vitest';
import {
  extractMapCoordinates,
  getMapQuery,
  getMapResolutionSource,
  getMapUrlQuery,
  getSafeMapOpenUrl,
  toMapCoordinates,
} from './map-location';

describe('map location helpers', () => {
  it('extracts coordinates from common Google Maps URL formats', () => {
    expect(extractMapCoordinates('https://www.google.com/maps/place/Turin/@45.0703,7.6869,15z')).toEqual({ lat: 45.0703, lon: 7.6869 });
    expect(extractMapCoordinates('https://www.google.com/maps/embed?!3d45.0703!4d7.6869')).toEqual({ lat: 45.0703, lon: 7.6869 });
    expect(extractMapCoordinates('https://maps.google.com/?q=45.0703,7.6869')).toEqual({ lat: 45.0703, lon: 7.6869 });
  });

  it('rejects invalid coordinate ranges', () => {
    expect(toMapCoordinates('91', '7')).toBeNull();
    expect(toMapCoordinates('45', '181')).toBeNull();
  });

  it('derives a useful lookup query from map URLs without coordinates', () => {
    expect(getMapUrlQuery('https://www.google.com/maps/search/?api=1&query=Porta+Nuova+Torino')).toBe('Porta Nuova Torino');
    expect(getMapUrlQuery('https://www.google.com/maps/place/Piazza+Castello+Torino')).toBe('Piazza Castello Torino');
    expect(getMapQuery('', '', 'Map', 'https://maps.google.com/?q=Torino')).toBe('Torino');
  });

  it('uses a safe OpenStreetMap search fallback and stable resolution signature', () => {
    expect(getSafeMapOpenUrl('javascript:alert(1)', 'Torino')).toBe('https://www.openstreetmap.org/search?query=Torino');
    expect(getMapResolutionSource('Venue', 'Torino', 'https://maps.example/test')).toBe('Venue|Torino|https://maps.example/test');
  });
});
