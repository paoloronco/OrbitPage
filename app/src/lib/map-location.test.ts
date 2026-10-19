import { describe, expect, it } from 'vitest';
import {
  extractMapCoordinates,
  getMapQuery,
  getMapPreviewUrl,
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
    expect(toMapCoordinates('45oops', '7')).toBeNull();
    expect(toMapCoordinates('', '')).toBeNull();
    expect(toMapCoordinates(0, 0)).toEqual({ lat: 0, lon: 0 });
  });

  it('uses the place marker instead of the viewport and supports OpenStreetMap and plain coordinates', () => {
    expect(extractMapCoordinates('https://www.google.com/maps/place/Test/@45,7,15z/data=!3d45.1!4d7.2')).toEqual({ lat: 45.1, lon: 7.2 });
    expect(extractMapCoordinates('https://www.google.com/maps/embed?pb=!2d7.2!3d45.1')).toEqual({ lat: 45.1, lon: 7.2 });
    expect(extractMapCoordinates('https://www.openstreetmap.org/?mlat=45.1&mlon=7.2#map=15/45/7')).toEqual({ lat: 45.1, lon: 7.2 });
    expect(extractMapCoordinates('https://www.openstreetmap.org/#map=15/45.1/7.2')).toEqual({ lat: 45.1, lon: 7.2 });
    expect(extractMapCoordinates('45.1, 7.2')).toEqual({ lat: 45.1, lon: 7.2 });
  });

  it('previews an address or full Maps URL without geocoding and validates embed hosts', () => {
    expect(getMapPreviewUrl('', 'Via Roma 1, Torino')).toContain('q=Via+Roma+1%2C+Torino&output=embed');
    expect(getMapPreviewUrl('https://www.google.it/maps/place/Torino', 'Different label')).toContain('q=Torino&output=embed');
    expect(getMapPreviewUrl('https://www.google.com/maps/embed?pb=!1m2!test')).toBe('https://www.google.com/maps/embed?pb=%211m2%21test');
    expect(getMapPreviewUrl('https://www.google.com/maps?cid=123')).toContain('cid=123&output=embed');
    expect(getMapPreviewUrl('https://maps.app.goo.gl/abc', 'Label')).toBe('');
    expect(getMapPreviewUrl('https://google.com.attacker.net/maps/embed?pb=test')).toBe('');
    expect(getMapPreviewUrl('https://www.google.com:8443/maps/embed?pb=test')).toBe('');
    expect(getMapPreviewUrl('')).toBe('');
  });

  it('derives a useful lookup query from map URLs without coordinates', () => {
    expect(getMapUrlQuery('https://www.google.com/maps/search/?api=1&query=Porta+Nuova+Torino')).toBe('Porta Nuova Torino');
    expect(getMapUrlQuery('https://www.google.com/maps/place/Piazza+Castello+Torino')).toBe('Piazza Castello Torino');
    expect(getMapQuery('', '', 'Map', 'https://maps.google.com/?q=Torino')).toBe('Torino');
  });

  it('uses a safe OpenStreetMap search fallback and stable resolution signature', () => {
    expect(getSafeMapOpenUrl('javascript:alert(1)', 'Torino')).toBe('https://www.openstreetmap.org/search?query=Torino');
    expect(getSafeMapOpenUrl('http://127.0.0.1/admin', 'Torino')).toBe('https://www.openstreetmap.org/search?query=Torino');
    expect(getSafeMapOpenUrl('https://maps.example.com/place', 'Torino')).toBe('https://maps.example.com/place');
    expect(getMapResolutionSource('Venue', 'Torino', 'https://maps.example/test')).toBe('Venue|Torino|https://maps.example/test');
  });
});
