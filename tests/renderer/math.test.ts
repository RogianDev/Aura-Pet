import { describe, expect, it } from 'vitest';
import { clamp, clampUnit } from '../../src/renderer/utils/math';

describe('clamp', () => {
  it('devuelve el valor si ya esta dentro del intervalo', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('acota por debajo', () => {
    expect(clamp(-3, 0, 1)).toBe(0);
  });

  it('acota por encima', () => {
    expect(clamp(7, 0, 1)).toBe(1);
  });

  it('devuelve min ante un NaN en lugar de propagarlo', () => {
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
  });

  it('devuelve min si el intervalo llega invertido', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});

describe('clampUnit', () => {
  it('acota al intervalo -1..1', () => {
    expect(clampUnit(-2)).toBe(-1);
    expect(clampUnit(2)).toBe(1);
  });

  it('deja intacto un valor ya normalizado', () => {
    expect(clampUnit(0.25)).toBe(0.25);
    expect(clampUnit(-0.75)).toBe(-0.75);
  });
});