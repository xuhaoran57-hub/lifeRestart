import { describe, expect, it } from 'vitest';
import type { ExamScoreResult, GameState } from '../src/app/types';
import { zhCnContent } from '../src/content/zh-cn';
import { resolveAdmission } from '../src/engine/admission';
import { createInitialProps } from '../src/engine/properties';
import { Random } from '../src/engine/random';

describe('resolveAdmission', () => {
  it('marks 985 and 211 reachable from real admission lines', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 75, RSK: 20 }), exam(650), new Random(1));

    expect(result.canReach985).toBe(true);
    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(true);
    expect(['985', '211']).toContain(result.admissionTier);
  });

  it('marks 211 reachable at a mid sample score', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 60, RSK: 25 }), exam(590), new Random(2));

    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(true);
  });

  it('falls back when score is below sampled undergraduate lines', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 20, RSK: 50 }), exam(280), new Random(3));

    expect(result.canReach211).toBe(false);
    expect(result.admitted).toBe(false);
    expect(result.admissionTier).toBe('retake');
  });

  it('can slide when score is enough but volunteer strategy collapses', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 5, RSK: 80 }), exam(590), new Random(1));

    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(false);
    expect(result.admissionTier).toBe('slide');
  });

  it('is reproducible with the same seed', () => {
    const state = stateWithScoreProps({ HVOL: 70, RSK: 20 });
    const first = resolveAdmission(zhCnContent, state, exam(610), new Random(2026));
    const second = resolveAdmission(zhCnContent, state, exam(610), new Random(2026));

    expect(second.admittedUniversity?.code).toBe(first.admittedUniversity?.code);
    expect(second.admittedLine?.groupCode).toBe(first.admittedLine?.groupCode);
  });
});

function exam(finalScore: number): ExamScoreResult {
  return {
    finalScore,
    potentialScore: finalScore,
    variance: 0,
    explanation: 'test',
  };
}

function stateWithScoreProps(values: Partial<GameState['props']>): GameState {
  return {
    props: { ...createInitialProps(), ...values },
    selectedTalentIds: [],
    triggeredTalentIds: [],
    eventIds: [],
    endingIds: [],
    logs: [],
    stepIndex: 64,
    currentRound: null,
    finalEnding: null,
    admissionResult: null,
    isFinished: false,
  };
}
