/**
 * Regressioni di sicurezza — CVE #69 (brace-expansion) e CVE #71 (qs)
 *
 * Questi test verificano che i pacchetti vulnerabili siano stati aggiornati e
 * che i comportamenti crashanti/DoS non si ripresentino.
 */
import { describe, it, expect } from 'vitest';
import qs from 'qs';
import { expand } from '../node_modules/brace-expansion/dist/esm/index.js';

// ---------------------------------------------------------------------------
// #71 — qs ≤ 6.15.1: TypeError in qs.stringify con arrayFormat:'comma' +
//        encodeValuesOnly:true su array con null o undefined
// ---------------------------------------------------------------------------
describe('security: qs #71 — stringify con array contenenti null/undefined', () => {
  const opts = { arrayFormat: 'comma', encodeValuesOnly: true };

  it('non crasha con array che contiene null', () => {
    expect(() => qs.stringify({ a: ['x', null, 'y'] }, opts)).not.toThrow();
  });

  it('non crasha con array che contiene undefined', () => {
    expect(() => qs.stringify({ a: ['x', undefined, 'y'] }, opts)).not.toThrow();
  });

  it('non crasha con array composto solo da null', () => {
    expect(() => qs.stringify({ a: [null] }, opts)).not.toThrow();
  });

  it('restituisce una stringa (non lancia TypeError) su array misto null+undefined', () => {
    const result = qs.stringify({ a: [null, undefined, 'z'] }, opts);
    expect(typeof result).toBe('string');
  });

  it('continua a funzionare correttamente con array senza null/undefined', () => {
    expect(qs.stringify({ a: ['x', 'y', 'z'] }, opts)).toBe('a=x,y,z');
  });

  it('continua a funzionare correttamente con array di un solo elemento', () => {
    expect(qs.stringify({ a: ['solo'] }, opts)).toBe('a=solo');
  });

  it('continua a funzionare con array vuoto', () => {
    expect(qs.stringify({ a: [] }, opts)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// #69 — brace-expansion ≤ 5.0.5: max applicato troppo tardi — range numerici
//        grandi allocano O(N) memoria anche con max piccolo
// ---------------------------------------------------------------------------
describe('security: brace-expansion #69 — DoS su range numerico con max piccolo', () => {
  it('rispetta max e restituisce al più max elementi', () => {
    const result = expand('{1..1000000}', { max: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('completa in tempo ragionevole su range esteso (≤ 100 ms)', () => {
    const start = Date.now();
    expand('{1..1000000}', { max: 10 });
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('non alloca memoria eccessiva su range esteso con max piccolo', () => {
    const before = process.memoryUsage().heapUsed;
    expand('{1..1000000}', { max: 10 });
    const deltaMB = (process.memoryUsage().heapUsed - before) / 1024 / 1024;
    // Con il bug, questo valore era ~20-80 MB; con il fix deve restare < 5 MB
    expect(deltaMB).toBeLessThan(5);
  });

  it('funziona correttamente su range piccoli (comportamento invariato)', () => {
    expect(expand('{1..5}')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('rispetta il default EXPANSION_MAX su range senza opzione max', () => {
    // il default è 100_000; un range molto più grande deve essere troncato
    const result = expand('{1..500000}');
    expect(result.length).toBeLessThanOrEqual(100_000);
  });

  it('funziona correttamente su sequenze alfabetiche', () => {
    expect(expand('{a..e}')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
