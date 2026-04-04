import { describe, it, expect } from 'vitest';
import { checkHealth } from '../../src/shared/health';

describe('health', () => {
  it("devuelve status 'ok' con timestamp ISO", () => {
    const result = checkHealth();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
