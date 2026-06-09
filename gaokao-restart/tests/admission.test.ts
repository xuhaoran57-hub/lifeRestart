import { describe, expect, it } from 'vitest';
import type { ExamScoreResult, GameContent, GameState, SubjectTrack } from '../src/app/types';
import { zhCnContent } from '../src/content/zh-cn';
import { resolveAdmission } from '../src/engine/admission';
import { createInitialProps } from '../src/engine/properties';
import { Random } from '../src/engine/random';

describe('resolveAdmission', () => {
  it('marks 985 and 211 reachable from physics admission lines', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 75, RSK: 20 }), exam(650), new Random(1));

    expect(result.profileId).toBe('ah-2025-physics');
    expect(result.subjectTrack).toBe('physics');
    expect(result.canReach985).toBe(true);
    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(true);
    expect(['985', '211', 'doubleFirstClass']).toContain(result.admissionTier);
  });

  it('marks 211 reachable at a mid sample score', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 60, RSK: 25 }), exam(590), new Random(2));

    expect(result.canReach211).toBe(true);
    expect(result.admitted).toBe(true);
  });

  it('usually commits to 985 when a strong 985 line is reachable', () => {
    let admitted985 = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 80, RSK: 15 }), exam(680), new Random(seed));
      if (result.admissionTier === '985') admitted985 += 1;
    }

    expect(admitted985).toBeGreaterThanOrEqual(50);
  });

  it('usually commits to 211 or above when a 211 line is reachable', () => {
    let admitted211Plus = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 70, RSK: 20 }), exam(600), new Random(seed));
      if (['985', '211'].includes(result.admissionTier)) admitted211Plus += 1;
    }

    expect(admitted211Plus).toBeGreaterThanOrEqual(50);
  });

  it('lets high-line non-211 schools compete with reachable low-line 211 schools', () => {
    const content = highLinePeerFixtureContent();
    let highLinePeerAdmissions = 0;

    for (let seed = 1; seed <= 80; seed += 1) {
      const result = resolveAdmission(content, stateWithScoreProps({ HVOL: 80, RSK: 10 }), exam(620), new Random(seed));
      if (result.admittedUniversity?.code === 'industry-u') highLinePeerAdmissions += 1;
    }

    expect(highLinePeerAdmissions).toBeGreaterThan(0);
  });

  it('uses history admission lines for history track', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 60, RSK: 25 }, 'history'), exam(590), new Random(2));

    expect(result.profileId).toBe('ah-2025-history');
    expect(result.subjectTrack).toBe('history');
    expect(result.canReach211).toBe(true);
    expect(result.canReach985).toBe(false);
  });

  it('falls back when score is below sampled undergraduate lines', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 20, RSK: 50 }), exam(280), new Random(3));

    expect(result.canReach211).toBe(false);
    expect(result.admitted).toBe(false);
    expect(result.admissionTier).toBe('retake');
  });

  it('can slide below 211 level when volunteer strategy collapses', () => {
    const result = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 5, RSK: 80 }), exam(530), new Random(1));

    expect(result.canReach211).toBe(false);
    expect(result.admitted).toBe(false);
    expect(result.admissionTier).toBe('slide');
  });

  it('gives retake runs a small volunteer strategy correction', () => {
    const first = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 45, RSK: 50 }), exam(590), new Random(4));
    const retake = resolveAdmission(zhCnContent, stateWithScoreProps({ HVOL: 45, RSK: 50 }, 'physics', true), exam(590), new Random(4));

    expect(retake.strategyScore ?? 0).toBeGreaterThan(first.strategyScore ?? 0);
  });

  it('is reproducible with the same seed', () => {
    const state = stateWithScoreProps({ HVOL: 70, RSK: 20 });
    const first = resolveAdmission(zhCnContent, state, exam(610), new Random(2026));
    const second = resolveAdmission(zhCnContent, state, exam(610), new Random(2026));

    expect(second.admittedUniversity?.code).toBe(first.admittedUniversity?.code);
    expect(second.admittedLine?.groupCode).toBe(first.admittedLine?.groupCode);
  });

  it('hard-filters sino-foreign cooperation lines by resource need', () => {
    const content = cooperationOnlyFixtureContent();

    const insufficient = resolveAdmission(content, stateWithScoreProps({ MNY: 6, HVOL: 80, RSK: 12 }), exam(565), new Random(1));
    const eligible = resolveAdmission(content, stateWithScoreProps({ MNY: 7, HVOL: 80, RSK: 12 }), exam(565), new Random(1));

    expect(insufficient.admitted).toBe(false);
    expect(insufficient.isSinoForeign).toBeUndefined();
    expect(eligible.admitted).toBe(true);
    expect(eligible.isSinoForeign).toBe(true);
    expect(eligible.resourceGap).toBe(0);
  });

  it('weights eligible sino-foreign cooperation lines higher when resource is higher', () => {
    const content = cooperationFixtureContent();

    const thresholdResourceCount = countSinoForeignAdmissions(content, 7);
    const highResourceCount = countSinoForeignAdmissions(content, 10);

    expect(highResourceCount).toBeGreaterThan(thresholdResourceCount);
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

function stateWithScoreProps(values: Partial<GameState['props']>, subjectTrack: SubjectTrack = 'physics', retakeUsed = false): GameState {
  return {
    props: { ...createInitialProps(), ...values },
    subjectTrack,
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
    retakeUsed,
    retakeCount: retakeUsed ? 1 : 0,
    retakeFrom: null,
    attempt: retakeUsed ? 2 : 1,
    isFinished: false,
  };
}

function cooperationFixtureContent(): GameContent {
  return {
    talents: [],
    events: [],
    ages: [],
    endings: [],
    achievements: [],
    characters: [],
    admissionProfiles: [
      {
        id: 'ah-2025-physics',
        name: '安徽 2025 物理类',
        year: 2025,
        sourceProvince: '安徽',
        subjectTrack: '物理类',
        scoreScale: 750,
        batch: '本科普通批',
      },
    ],
    universities: [
      {
        code: 'normal-u',
        name: '普通本科大学',
        province: '安徽',
        city: '合肥',
        tags: [],
        prestigeTier: 'regional',
      },
      {
        code: 'coop-u',
        name: '合作办学大学',
        province: '江苏',
        city: '苏州',
        tags: [],
        prestigeTier: 'regional',
      },
    ],
    admissionLines: [
      {
        profileId: 'ah-2025-physics',
        universityCode: 'normal-u',
        universityName: '普通本科大学',
        groupCode: '001',
        groupName: '普通本科大学 001专业组（不限）',
        batch: '本科普通批',
        minScore: 550,
        minRank: 90000,
        subjectRequirement: '不限',
        sourceName: 'test',
        sourceUrl: 'https://example.com/8467',
        sourcePublishedAt: '2025-07-24',
        lineType: 'normal',
      },
      {
        profileId: 'ah-2025-physics',
        universityCode: 'coop-u',
        universityName: '合作办学大学',
        groupCode: '002',
        groupName: '合作办学大学 002专业组（不限）（中外合作办学）',
        batch: '本科普通批',
        minScore: 552,
        minRank: 88000,
        subjectRequirement: '不限',
        sourceName: 'test',
        sourceUrl: 'https://example.com/8467',
        sourcePublishedAt: '2025-07-24',
        lineType: 'sinoForeign',
        resourceNeed: 7,
      },
    ],
  };
}

function cooperationOnlyFixtureContent(): GameContent {
  const content = cooperationFixtureContent();
  return {
    ...content,
    admissionLines: content.admissionLines.filter(line => line.lineType === 'sinoForeign'),
  };
}

function countSinoForeignAdmissions(content: GameContent, resourceLevel: number): number {
  let count = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const result = resolveAdmission(
      content,
      stateWithScoreProps({ MNY: resourceLevel, HVOL: 45, RSK: 12 }),
      exam(565),
      new Random(seed),
    );
    if (result.admittedLine?.lineType === 'sinoForeign') count += 1;
  }
  return count;
}

function highLinePeerFixtureContent(): GameContent {
  return {
    talents: [],
    events: [],
    ages: [],
    endings: [],
    achievements: [],
    characters: [],
    admissionProfiles: [
      {
        id: 'ah-2025-physics',
        name: '安徽 2025 物理类',
        year: 2025,
        sourceProvince: '安徽',
        subjectTrack: '物理类',
        scoreScale: 750,
        batch: '本科普通批',
      },
    ],
    universities: [
      {
        code: 'low-211',
        name: '低线 211 大学',
        province: '新疆',
        city: '石河子',
        tags: ['211', 'doubleFirstClass'],
        prestigeTier: 'strong',
      },
      {
        code: 'industry-u',
        name: '高线行业大学',
        province: '上海',
        city: '上海',
        tags: [],
        prestigeTier: 'regional',
      },
      {
        code: 'ordinary-u',
        name: '低线普通本科',
        province: '安徽',
        city: '合肥',
        tags: [],
        prestigeTier: 'regional',
      },
    ],
    admissionLines: [
      {
        profileId: 'ah-2025-physics',
        universityCode: 'low-211',
        universityName: '低线 211 大学',
        groupCode: '001',
        groupName: '低线 211 大学 001专业组（不限）',
        batch: '本科普通批',
        minScore: 555,
        minRank: 72000,
        subjectRequirement: '不限',
        sourceName: 'test',
        sourceUrl: 'https://example.com/low-211',
        sourcePublishedAt: '2025-07-24',
        lineType: 'normal',
      },
      {
        profileId: 'ah-2025-physics',
        universityCode: 'industry-u',
        universityName: '高线行业大学',
        groupCode: '002',
        groupName: '高线行业大学 002专业组（化学）',
        batch: '本科普通批',
        minScore: 600,
        minRank: 30000,
        subjectRequirement: '化学',
        sourceName: 'test',
        sourceUrl: 'https://example.com/industry',
        sourcePublishedAt: '2025-07-24',
        lineType: 'normal',
      },
      {
        profileId: 'ah-2025-physics',
        universityCode: 'ordinary-u',
        universityName: '低线普通本科',
        groupCode: '003',
        groupName: '低线普通本科 003专业组（不限）',
        batch: '本科普通批',
        minScore: 520,
        minRank: 110000,
        subjectRequirement: '不限',
        sourceName: 'test',
        sourceUrl: 'https://example.com/ordinary',
        sourcePublishedAt: '2025-07-24',
        lineType: 'normal',
      },
    ],
  };
}
