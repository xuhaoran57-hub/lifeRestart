import { describe, expect, it } from 'vitest';
import type { AdmissionResult, GameState } from '../src/app/types';
import { zhCnContent } from '../src/content/zh-cn';
import { pickEnding } from '../src/engine/endings';
import { createInitialProps } from '../src/engine/properties';

describe('pickEnding', () => {
  it('uses the 985 narrow-margin ending before broad undergraduate endings', () => {
    const state = stateWithProps({ HSCR: 620, VOL: 85, RSK: 35 });
    const admission = admission985WithMargin(3, 3);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('985 压线录取');
  });

  it('uses the stable 985 ending when the score is 20 points above the lowest 985 line', () => {
    const state = stateWithProps({ HSCR: 650, VOL: 85, RSK: 35 });
    const admission = admission985WithMargin(3, 20);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('稳上 985');
  });

  it('does not let the collapse ending override a real 985 admission', () => {
    const state = stateWithProps({ HSCR: 650, SPR: 1, VOL: 85, RSK: 80 });
    const admission = admission985WithMargin(3, 20);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('稳上 985');
  });

  it('uses the recommendation-based admission ending when the talent condition is met', () => {
    const state = stateWithProps({ AGE: 17, INT: 8, VOL: 50, RSK: 30, HSCR: 620 });
    state.selectedTalentIds = [21804];
    state.eventIds = [32405];
    const admission = admission985WithMargin(20, 20);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('保送上岸');
  });

  it('uses retake comparison endings instead of repeating the first ending', () => {
    const state = retakeStateWithProps({ HSCR: 650, VOL: 85, RSK: 35 }, {
      endingId: 41002,
      endingName: '稳上 985',
      finalScore: 650,
      admissionTier: '985',
      admittedUniversityCode: '10269',
      admittedUniversityName: '华东师范大学',
      margin: 20,
      canReach985: true,
      canReach211: true,
      props: createInitialProps(),
    });
    const admission = admission985WithMargin(3, 20);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('二战高位稳住');
  });

  it('uses current attempt events for retake ending conditions', () => {
    const state = retakeStateWithProps({ HSCR: 540, VOL: 45, RSK: 45 }, {
      endingId: 41003,
      endingName: '竞赛保送生',
      finalScore: 540,
      admissionTier: 'undergraduate',
      canReach985: false,
      canReach211: false,
      props: createInitialProps(),
    });
    state.eventIds = [31017];
    state.currentAttemptEventIds = [];
    const admission = admissionUndergraduate(540);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).not.toBe('竞赛保送生');
  });

  it('uses a 985 retake breakthrough ending when the tier improves', () => {
    const state = retakeStateWithProps({ HSCR: 660, VOL: 85, RSK: 30 }, {
      endingId: 41111,
      endingName: '普通本科稳住',
      finalScore: 560,
      admissionTier: 'undergraduate',
      admittedUniversityCode: '10378',
      admittedUniversityName: '安徽财经大学',
      margin: 12,
      canReach985: false,
      canReach211: false,
      props: createInitialProps(),
    });
    const admission = admission985WithMargin(15, 15);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('复读冲进 985');
  });
});

function stateWithProps(values: Partial<GameState['props']>): GameState {
  return {
    props: { ...createInitialProps(), ...values },
    subjectTrack: 'physics',
    selectedTalentIds: [],
    triggeredTalentIds: [],
    eventIds: [],
    currentAttemptEventIds: [],
    endingIds: [],
    logs: [],
    stepIndex: 70,
    currentRound: null,
    finalEnding: null,
    admissionResult: null,
    retakeUsed: false,
    retakeFrom: null,
    attempt: 1,
    isFinished: false,
  };
}

function retakeStateWithProps(values: Partial<GameState['props']>, retakeFrom: GameState['retakeFrom']): GameState {
  return {
    ...stateWithProps(values),
    retakeUsed: true,
    retakeFrom,
    attempt: 2,
  };
}

function admission985WithMargin(margin: number, lowestReachable985Margin: number): AdmissionResult {
  return {
    profileId: 'ah-2025-physics',
    profileName: '安徽 2025 物理类',
    subjectTrack: 'physics',
    subjectTrackName: '物理类',
    finalScore: 653,
    potentialScore: 650,
    variance: 3,
    canReach985: true,
    canReach211: true,
    lowestReachable985Margin,
    admitted: true,
    admittedUniversity: {
      code: '10269',
      name: '华东师范大学',
      province: '上海',
      city: '上海',
      tags: ['985', '211', 'doubleFirstClass'],
      prestigeTier: 'top',
    },
    admissionTier: '985',
    margin,
    strategyLabel: '冲刺',
    reason: 'test',
  };
}

function admissionUndergraduate(finalScore: number): AdmissionResult {
  return {
    profileId: 'ah-2025-physics',
    profileName: '安徽 2025 物理类',
    subjectTrack: 'physics',
    subjectTrackName: '物理类',
    finalScore,
    potentialScore: finalScore,
    variance: 0,
    canReach985: false,
    canReach211: false,
    admitted: true,
    admittedUniversity: {
      code: '10378',
      name: '安徽财经大学',
      province: '安徽',
      city: '蚌埠',
      tags: [],
      prestigeTier: 'regional',
    },
    admissionTier: 'undergraduate',
    margin: 12,
    strategyLabel: '均衡',
    reason: 'test',
  };
}
