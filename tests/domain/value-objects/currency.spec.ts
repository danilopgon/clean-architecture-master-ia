import { describe, it, expect } from 'vitest';
import { Currency } from '@domain/value-objects/Currency.js';

describe('Currency', () => {
  describe('create', () => {
    it('accepts valid ISO-4217 codes', () => {
      expect(Currency.create('EUR').ok).toBe(true);
      expect(Currency.create('USD').ok).toBe(true);
      expect(Currency.create('GBP').ok).toBe(true);
    });

    it('rejects empty string', () => {
      const r = Currency.create('');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_CURRENCY');
    });

    it('rejects lowercase letters', () => {
      const r = Currency.create('eur');
      expect(r.ok).toBe(false);
    });

    it('rejects 2-letter codes', () => {
      expect(Currency.create('EU').ok).toBe(false);
    });

    it('rejects 4-letter codes', () => {
      expect(Currency.create('EURO').ok).toBe(false);
    });

    it('rejects codes with spaces', () => {
      expect(Currency.create('EU R').ok).toBe(false);
    });

    it('rejects numbers', () => {
      expect(Currency.create('EU1').ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for same value', () => {
      const a = Currency.create('EUR');
      const b = Currency.create('EUR');
      if (!a.ok || !b.ok) throw new Error('unexpected');
      expect(a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different values', () => {
      const a = Currency.create('EUR');
      const b = Currency.create('USD');
      if (!a.ok || !b.ok) throw new Error('unexpected');
      expect(a.value.equals(b.value)).toBe(false);
    });
  });
});
