import { describe, it, expect } from 'vitest';
import { Order } from '@domain/entities/Order.js';
import { OrderItem } from '@domain/entities/OrderItem.js';
import { OrderId } from '@domain/value-objects/OrderId.js';
import { SKU } from '@domain/value-objects/SKU.js';
import { Currency } from '@domain/value-objects/Currency.js';
import { Money } from '@domain/value-objects/Money.js';
import { Quantity } from '@domain/value-objects/Quantity.js';
import type { OrderCreated } from '@domain/events/OrderCreated.js';
import type { OrderItemAdded } from '@domain/events/OrderItemAdded.js';
import type { OrderPlaced } from '@domain/events/OrderPlaced.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-04-05T00:00:00Z');

function orderId(v = 'order-1'): OrderId {
  const r = OrderId.create(v);
  if (!r.ok) throw new Error('unexpected');
  return r.value;
}

function sku(v: string): SKU {
  const r = SKU.create(v);
  if (!r.ok) throw new Error(`unexpected: ${r.error.message}`);
  return r.value;
}

function money(amount: number, iso: string): Money {
  const c = Currency.create(iso);
  if (!c.ok) throw new Error('unexpected');
  const m = Money.create(amount, c.value);
  if (!m.ok) throw new Error(`unexpected: ${m.error.message}`);
  return m.value;
}

function qty(n: number): Quantity {
  const r = Quantity.create(n);
  if (!r.ok) throw new Error('unexpected');
  return r.value;
}

function item(skuVal: string, amount: number, iso: string, quantity: number): OrderItem {
  const r = OrderItem.create({
    sku: sku(skuVal),
    unitPrice: money(amount, iso),
    quantity: qty(quantity),
  });
  if (!r.ok) throw new Error('unexpected');
  return r.value;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Order aggregate', () => {
  describe('create', () => {
    it('starts in DRAFT status', () => {
      expect(Order.create(orderId(), NOW).status).toBe('DRAFT');
    });

    it('emits OrderCreated event', () => {
      const order = Order.create(orderId(), NOW);
      const events = order.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]?.name).toBe('OrderCreated');
      const evt = events[0] as OrderCreated;
      expect(evt.orderId.value).toBe('order-1');
    });

    it('pullEvents clears the buffer', () => {
      const order = Order.create(orderId(), NOW);
      order.pullEvents();
      expect(order.pullEvents()).toHaveLength(0);
    });

    it('stores createdAt', () => {
      expect(Order.create(orderId(), NOW).createdAt).toBe(NOW);
    });
  });

  describe('addItem', () => {
    it('adds an item in DRAFT', () => {
      const order = Order.create(orderId(), NOW);
      order.pullEvents();

      const result = order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 2), NOW);
      expect(result.ok).toBe(true);
      expect(order.getItems()).toHaveLength(1);
    });

    it('emits OrderItemAdded with correct SKU', () => {
      const order = Order.create(orderId(), NOW);
      order.pullEvents();

      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 2), NOW);
      const events = order.pullEvents();
      expect(events).toHaveLength(1);
      const evt = events[0] as OrderItemAdded;
      expect(evt.name).toBe('OrderItemAdded');
      expect(evt.sku.value).toBe('SHIRT-RED-L');
      expect(evt.quantity.value).toBe(2);
    });

    it('merges quantities for same SKU + same price + same currency', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 2), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 3), NOW);

      const items = order.getItems();
      expect(items).toHaveLength(1);
      expect(items[0]?.quantity.value).toBe(5);
    });

    it('creates separate lines for same SKU but different currency', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      order.addItem(item('SHIRT-RED-L', 800, 'USD', 1), NOW);

      expect(order.getItems()).toHaveLength(2);
    });

    it('creates separate lines for same SKU, same currency, different unit price', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      order.addItem(item('SHIRT-RED-L', 900, 'EUR', 1), NOW);

      expect(order.getItems()).toHaveLength(2);
    });

    it('fails with ORDER_NOT_DRAFT after place', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      order.place(NOW);

      const result = order.addItem(item('BOOK-001', 500, 'EUR', 1), NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('ORDER_NOT_DRAFT');
    });
  });

  describe('removeItem', () => {
    it('removes an existing item by SKU', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      const result = order.removeItem(sku('SHIRT-RED-L'), NOW);
      expect(result.ok).toBe(true);
      expect(order.getItems()).toHaveLength(0);
    });

    it('fails with ITEM_NOT_FOUND for unknown SKU', () => {
      const order = Order.create(orderId(), NOW);
      const result = order.removeItem(sku('UNKNOWN-SKU'), NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('ITEM_NOT_FOUND');
    });

    it('fails with ORDER_NOT_DRAFT after place', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      order.place(NOW);
      const result = order.removeItem(sku('SHIRT-RED-L'), NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('ORDER_NOT_DRAFT');
    });
  });

  describe('place', () => {
    it('transitions to PLACED', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      expect(order.place(NOW).ok).toBe(true);
      expect(order.status).toBe('PLACED');
    });

    it('emits OrderPlaced with correct totals', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 2), NOW); // 2000 EUR
      order.addItem(item('BOOK-001', 500, 'EUR', 1), NOW);     //  500 EUR → total 2500
      order.addItem(item('MUG-BLK', 800, 'USD', 1), NOW);      //  800 USD
      order.pullEvents();

      order.place(NOW);
      const events = order.pullEvents();
      const evt = events[0] as OrderPlaced;
      expect(evt.name).toBe('OrderPlaced');
      expect(evt.totals.get('EUR')?.amount).toBe(2500);
      expect(evt.totals.get('USD')?.amount).toBe(800);
    });

    it('fails with ORDER_EMPTY if no items', () => {
      const result = Order.create(orderId(), NOW).place(NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('ORDER_EMPTY');
    });

    it('fails with ORDER_NOT_DRAFT on second place', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);
      order.place(NOW);
      const result = order.place(NOW);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('ORDER_NOT_DRAFT');
    });
  });

  describe('totalsByCurrency', () => {
    it('returns empty map for order with no items', () => {
      expect(Order.create(orderId(), NOW).totalsByCurrency().size).toBe(0);
    });

    it('aggregates subtotals by currency', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 2), NOW); // 2000 EUR
      order.addItem(item('BOOK-001', 500, 'EUR', 1), NOW);     //  500 EUR → 2500
      order.addItem(item('MUG-BLK', 800, 'USD', 1), NOW);      //  800 USD

      const totals = order.totalsByCurrency();
      expect(totals.get('EUR')?.amount).toBe(2500);
      expect(totals.get('USD')?.amount).toBe(800);
      expect(totals.size).toBe(2);
    });
  });

  describe('getItems isolation', () => {
    it('mutating the returned array does not affect the order', () => {
      const order = Order.create(orderId(), NOW);
      order.addItem(item('SHIRT-RED-L', 1000, 'EUR', 1), NOW);

      const snapshot = order.getItems() as OrderItem[];
      snapshot.splice(0, 1);

      expect(order.getItems()).toHaveLength(1);
    });
  });

  describe('OrderItem equality', () => {
    it('two items with same properties are equal', () => {
      const a = item('SHIRT-RED-L', 1000, 'EUR', 2);
      const b = item('SHIRT-RED-L', 1000, 'EUR', 2);
      expect(a.equals(b)).toBe(true);
    });

    it('items with different quantities are not equal', () => {
      expect(item('SHIRT-RED-L', 1000, 'EUR', 2).equals(item('SHIRT-RED-L', 1000, 'EUR', 3))).toBe(false);
    });

    it('items with different SKUs are not equal', () => {
      expect(item('SHIRT-RED-L', 1000, 'EUR', 1).equals(item('SHIRT-BLUE-L', 1000, 'EUR', 1))).toBe(false);
    });
  });
});
