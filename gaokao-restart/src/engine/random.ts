export class Random {
  private seed: number;

  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  int(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export function pickWeighted<T>(
  items: T[],
  weightOf: (item: T) => number,
  random: Random,
): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0);
  if (total <= 0) return items[0] ?? null;

  let cursor = random.next() * total;
  for (const item of items) {
    cursor -= Math.max(0, weightOf(item));
    if (cursor <= 0) return item;
  }
  return items.at(-1) ?? null;
}

export function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = random.int(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
