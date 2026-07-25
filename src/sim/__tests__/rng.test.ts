import { describe, expect, it } from "vitest";
import { createRng, deriveStream, restoreRng } from "@/shared/rng";

describe("seeded rng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("differs across seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("resumes exactly from saved state", () => {
    const a = createRng(42);
    for (let i = 0; i < 10; i++) a.next();
    const resumed = restoreRng(a.state());
    expect(resumed.next()).toBe(createRngAdvanced(42, 11));
  });

  it("derives independent stable streams", () => {
    const s1 = deriveStream(7, "guests");
    const s2 = deriveStream(7, "weather");
    const s1again = deriveStream(7, "guests");
    expect(s1.next()).toBe(s1again.next());
    const x = deriveStream(7, "guests");
    const y = deriveStream(7, "weather");
    expect(Array.from({ length: 4 }, () => x.next())).not.toEqual(
      Array.from({ length: 4 }, () => y.next()),
    );
  });

  it("int() stays inclusive within bounds", () => {
    const rng = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

function createRngAdvanced(seed: number, n: number): number {
  const rng = createRng(seed);
  let v = 0;
  for (let i = 0; i < n; i++) v = rng.next();
  return v;
}
