import { describe, it, expect } from 'vitest';
import { SKU } from '@domain/value-objects/SKU.js';

describe('SKU', () => {
  describe('create', () => {
    it('accepts simple uppercase alphanumeric', () => {
      expect(SKU.create('BOOK001').ok).toBe(true);
    });

    it('accepts hyphens and underscores', () => {
      expect(SKU.create('SHIRT-RED-L').ok).toBe(true);
      expect(SKU.create('BOOK_001').ok).toBe(true);
    });

    it('rejects empty string', () => {
      const r = SKU.create('');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_ID');
    });

    it('rejects lowercase letters', () => {
      expect(SKU.create('shirt-red').ok).toBe(false);
    });

    it('rejects strings starting with hyphen', () => {
      expect(SKU.create('-BOOK').ok).toBe(false);
    });

    it('rejects whitespace', () => {
      expect(SKU.create('BOOK 001').ok).toBe(false);
    });

    it('rejects special characters', () => {
      expect(SKU.create('BOOK@001').ok).toBe(false);
    });

    it('trims surrounding whitespace before validating', () => {
      const r = SKU.create('  BOOK001  ');
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.value).toBe('BOOK001');
    });
  });

  describe('equals', () => {
    it('returns true for same value', () => {
      const a = SKU.create('BOOK001');
      const b = SKU.create('BOOK001');
      if (!a.ok || !b.ok) throw new Error('unexpected');
      expect(a.value.equals(b.value)).toBe(true);
    });

    it('returns false for different values', () => {
      const a = SKU.create('BOOK001');
      const b = SKU.create('BOOK002');
      if (!a.ok || !b.ok) throw new Error('unexpected');
      expect(a.value.equals(b.value)).toBe(false);
    });
  });
});
