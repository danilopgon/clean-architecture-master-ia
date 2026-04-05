import { describe, it, expect } from 'vitest';
import { Quantity } from '@domain/value-objects/Quantity.js';

function qty(n: number): Quantity {
  const r = Quantity.create(n);
  if (!r.ok) throw new Error(`unexpected: ${r.error.message}`);
  return r.value;
}

describe('Quantity', () => {
  describe('create', () => {
    it('accepts positive integers', () => {
      expect(qty(1).value).toBe(1);
      expect(qty(99).value).toBe(99);
    });

    it('rejects zero', () => {
      const r = Quantity.create(0);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_QUANTITY');
    });

    it('rejects negative values', () => {
      expect(Quantity.create(-1).ok).toBe(false);
    });

    it('rejects non-integer values', () => {
      expect(Quantity.create(1.5).ok).toBe(false);
    });
  });

  describe('add', () => {
    it('returns sum of both quantities', () => {
      expect(qty(3).add(qty(4)).value).toBe(7);
    });

    it('returns a new instance (immutability)', () => {
      const a = qty(5);
      const result = a.add(qty(2));
      expect(a.value).toBe(5);
      expect(result.value).toBe(7);
    });
  });

  describe('equals', () => {
    it('returns true for same value', () => {
      expect(qty(3).equals(qty(3))).toBe(true);
    });

    it('returns false for different values', () => {
      expect(qty(3).equals(qty(4))).toBe(false);
    });
  });
});
