import { describe, expect, it } from 'vitest';
import type { ExamScoreResult, GameState } from '../src/app/types';
import { zhCnContent } from '../src/content/zh-cn';
import { resolveAdmission } from '../src/engine/admission';
import { createInitialProps } from '../src/engine/properties';

describe('resolveAdmission', () => {
  it('marks 985 and 211 reachable from real admission lines', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 75, RSK: 20 }), exam(650));

    expect(result.canReach985).toBe(true);
    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(true);
    expect(['985', '211']).toContain(result.admissionTier);
  });

  it('marks 211 reachable below the sample 985 floor', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 60, RSK: 25 }), exam(590));

    expect(result.canReach985).toBe(false);
    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(true);
  });

  it('falls back when score is below sampled undergraduate lines', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 20, RSK: 50 }), exam(280));

    expect(result.canReach211).toBe(false);
    expect(result.admitted).toBe(false);
    expect(result.admissionTier).toBe('retake');
  });

  it('can slide when score is enough but volunteer strategy collapses', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 5, RSK: 80 }), exam(590));

    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(false);
    expect(result.admissionTier).toBe('slide');
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
