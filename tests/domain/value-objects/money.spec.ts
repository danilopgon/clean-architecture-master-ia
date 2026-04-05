import { describe, it, expect } from 'vitest';
import { Currency } from '@domain/value-objects/Currency.js';
import { Money } from '@domain/value-objects/Money.js';

function eur(amount: number): Money {
  const c = Currency.create('EUR');
  if (!c.ok) throw new Error('unexpected');
  const m = Money.create(amount, c.value);
  if (!m.ok) throw new Error(`unexpected: ${m.error.message}`);
  return m.value;
}

function usd(amount: number): Money {
  const c = Currency.create('USD');
  if (!c.ok) throw new Error('unexpected');
  const m = Money.create(amount, c.value);
  if (!m.ok) throw new Error(`unexpected: ${m.error.message}`);
  return m.value;
}

describe('Money', () => {
  describe('create', () => {
    it('accepts zero', () => {
      expect(eur(0).amount).toBe(0);
    });

    it('accepts positive integers', () => {
      expect(eur(1000).amount).toBe(1000);
    });

    it('rejects non-integer amounts', () => {
      const c = Currency.create('EUR');
      if (!c.ok) throw new Error('unexpected');
      const r = Money.create(10.5, c.value);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_MONEY');
    });

    it('rejects negative amounts', () => {
      const c = Currency.create('EUR');
      if (!c.ok) throw new Error('unexpected');
      const r = Money.create(-1, c.value);
      expect(r.ok).toBe(false);
    });
  });

  describe('add', () => {
    it('sums amounts with the same currency', () => {
      const result = eur(500).add(eur(300));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.amount).toBe(800);
    });

    it('fails with CURRENCY_MISMATCH for different currencies', () => {
      const result = eur(500).add(usd(300));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('CURRENCY_MISMATCH');
    });

    it('returns a new instance (immutability)', () => {
      const a = eur(500);
      const result = a.add(eur(100));
      expect(result.ok).toBe(true);
      expect(a.amount).toBe(500); // original unchanged
    });
  });

  describe('multiply', () => {
    it('multiplies by 0 gives zero', () => {
      const result = eur(1000).multiply(0);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.amount).toBe(0);
    });

    it('multiplies correctly', () => {
      const result = eur(1000).multiply(3);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.amount).toBe(3000);
    });

    it('rejects negative factor', () => {
      const result = eur(1000).multiply(-1);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_MONEY');
    });

    it('rejects non-integer factor', () => {
      const result = eur(1000).multiply(1.5);
      expect(result.ok).toBe(false);
    });

    it('returns a new instance (immutability)', () => {
      const a = eur(1000);
      const result = a.multiply(2);
      expect(result.ok).toBe(true);
      expect(a.amount).toBe(1000); // original unchanged
    });
  });

  describe('equals', () => {
    it('returns true for same amount and currency', () => {
      expect(eur(500).equals(eur(500))).toBe(true);
    });

    it('returns false for different amount', () => {
      expect(eur(500).equals(eur(600))).toBe(false);
    });

    it('returns false for different currency', () => {
      expect(eur(500).equals(usd(500))).toBe(false);
    });
  });
});
