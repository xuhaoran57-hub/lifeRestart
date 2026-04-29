import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/engine/condition';

describe('evaluateCondition', () => {
  const context = {
    props: { INT: 7, SPR: 3, AGE: 17, HSCR: 610 },
    talentIds: new Set([21010, 21016]),
    eventIds: new Set([31017]),
    endingIds: new Set([41003]),
  };

  it('evaluates numeric comparisons and boolean groups', () => {
    expect(evaluateCondition('(INT>6)&(SPR>=3)', context)).toBe(true);
    expect(evaluateCondition('(INT<6)|(HSCR>=600)', context)).toBe(true);
    expect(evaluateCondition('(INT<6)&(HSCR>=600)', context)).toBe(false);
  });

  it('evaluates id membership checks', () => {
    expect(evaluateCondition('TLT?[21010]', context)).toBe(true);
    expect(evaluateCondition('TLT![21011]', context)).toBe(true);
    expect(evaluateCondition('EVT?[31017]', context)).toBe(true);
    expect(evaluateCondition('END?[41003]', context)).toBe(true);
    expect(evaluateCondition('AGE?[17]', context)).toBe(true);
  });
});
