import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/engine/condition';

describe('evaluateCondition', () => {
  const context = {
    props: { INT: 7, SPR: 3, AGE: 17, HSCR: 610 },
    talentIds: new Set([21010, 21016]),
    eventIds: new Set([31017]),
    endingIds: new Set([41003]),
    subjectTrack: 'physics' as const,
    admission: {
      profileId: 'ah-2025-physics',
      profileName: '安徽 2025 物理类',
      subjectTrack: 'physics' as const,
      subjectTrackName: '物理类',
      finalScore: 612,
      potentialScore: 610,
      variance: 2,
      canReach985: false,
      canReach211: true,
      admitted: true,
      admittedUniversity: {
        code: '10593',
        name: '广西大学',
        province: '广西',
        city: '南宁',
        tags: ['211', 'doubleFirstClass'],
        prestigeTier: 'solid' as const,
      },
      admissionTier: '211' as const,
      margin: 32,
      strategyLabel: '均衡' as const,
      reason: 'test',
    },
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

  it('evaluates admission membership and score tokens', () => {
    expect(evaluateCondition('ADM?[211]', context)).toBe(true);
    expect(evaluateCondition('ADM![985]', context)).toBe(true);
    expect(evaluateCondition('ADM?[doubleFirstClass]', context)).toBe(true);
    expect(evaluateCondition('SCHOOL?[10593]', context)).toBe(true);
    expect(evaluateCondition('ADMSCORE>=650', context)).toBe(false);
    expect(evaluateCondition('MARGIN>=20', context)).toBe(true);
    expect(evaluateCondition('SLIDE=1', context)).toBe(false);
  });

  it('evaluates subject track membership', () => {
    expect(evaluateCondition('TRACK?[physics]', context)).toBe(true);
    expect(evaluateCondition('TRACK![history]', context)).toBe(true);
  });
});
