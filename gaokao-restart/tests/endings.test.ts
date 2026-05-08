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

  it('uses the recommendation-based admission ending when the talent condition is met', () => {
    const state = stateWithProps({ INT: 8, VOL: 50, RSK: 30, HSCR: 620 });
    state.selectedTalentIds = [21804];
    const admission = admission985WithMargin(20, 20);

    const ending = pickEnding(zhCnContent, state, admission);

    expect(ending.name).toBe('保送上岸');
  });
});

function stateWithProps(values: Partial<GameState['props']>): GameState {
  return {
    props: { ...createInitialProps(), ...values },
    subjectTrack: 'physics',
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
