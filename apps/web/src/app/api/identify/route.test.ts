import { findItemBySku } from '@/lib/mock-inventory';
import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/identify (demo mode)', () => {
  it('returns 3 candidates with valid shape and a disambiguating question', async () => {
    const req = new Request('http://localhost:3000/api/identify?demo=true', {
      method: 'POST',
    });

    // Cast through `unknown` to satisfy the NextRequest expected type without pulling in next/server in the test runtime.
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      candidates: Array<{ sku: string; confidence: number; reasoning: string }>;
      disambiguatingQuestion: string | null;
      mode: string;
    };

    expect(body.mode).toBe('demo');
    expect(body.candidates).toHaveLength(3);
    expect(body.disambiguatingQuestion).toBeTruthy();
    for (const c of body.candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
      expect(c.reasoning.length).toBeLessThanOrEqual(200);
      // Sanity check — every demo SKU must be a real catalog entry.
      expect(findItemBySku(c.sku)).toBeDefined();
    }
  }, 5000);

  it('returns the post-answer response when ?answered=true', async () => {
    const req = new Request('http://localhost:3000/api/identify?demo=true&answered=true', {
      method: 'POST',
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      candidates: unknown[];
      disambiguatingQuestion: string | null;
    };
    expect(body.candidates).toHaveLength(1);
    expect(body.disambiguatingQuestion).toBeNull();
  }, 5000);
});
