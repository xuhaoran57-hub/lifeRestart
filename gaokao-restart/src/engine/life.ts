import type {
  AgeRound,
  Allocation,
  AdmissionResult,
  CorePropCode,
  Effect,
  Ending,
  ExamScoreResult,
  FinalResult,
  GameContent,
  GameEvent,
  GameState,
  Props,
  RunLog,
  StepResult,
  Talent,
  WeightedRef,
} from '../app/types';
import { calculateExamScore, resolveAdmission, resolveRecommendedAdmission } from './admission';
import { evaluateCondition } from './condition';
import { pickEnding } from './endings';
import { createConditionContext, getEventMap, isEventAvailable, pickEventForRound } from './events';
import { applyPropDelta, calculateSummaryScore, createInitialProps, refreshScore } from './properties';
import { pickWeighted, Random } from './random';
import { forcedSubjectTrackFromTalents, resolveSubjectTrack } from './subjectTrack';
import { getTalentMap, validateTalentSelection } from './talents';

const positiveEventEffectScale: Partial<Record<CorePropCode, number>> = {
  INT: 0.19,
  STR: 0.28,
  MNY: 0.5,
  SPR: 0.42,
  VOL: 0.5,
  RSK: 0.35,
  SCOREMOD: 0.65,
};

const negativeEventEffectScale: Partial<Record<CorePropCode, number>> = {
  INT: 0.3,
  STR: 0.35,
  MNY: 0.5,
  SPR: 0.42,
  VOL: 0.5,
  RSK: 0.35,
  SCOREMOD: 0.65,
};

const senior3PositiveEventEffectScale: Partial<Record<CorePropCode, number>> = {
  INT: 0.35,
  STR: 0.45,
  MNY: 0.5,
  SPR: 0.6,
  VOL: 0.8,
  RSK: 0.7,
  SCOREMOD: 1,
};

const senior3NegativeEventEffectScale: Partial<Record<CorePropCode, number>> = {
  INT: 0.45,
  STR: 0.55,
  MNY: 0.5,
  SPR: 0.7,
  VOL: 0.85,
  RSK: 0.6,
  SCOREMOD: 1,
};

const subjectTrackEventIds = {
  forcedPhysics: 32001,
  forcedHistory: 32002,
  physics: 32003,
  history: 32004,
} as const;

const retakeSenior3EventPool: WeightedRef[] = [
  { id: 31831, weight: 130 },
  { id: 31832, weight: 120 },
  { id: 31833, weight: 120 },
  { id: 31834, weight: 70 },
  { id: 31835, weight: 120 },
  { id: 31836, weight: 70 },
  { id: 31837, weight: 110 },
  { id: 31838, weight: 110 },
];

const retakeVolunteerEventPool: WeightedRef[] = [
  { id: 31839, weight: 140 },
];

const recommendedEndingEventPool: WeightedRef[] = [
  { id: 32401, weight: 100 },
  { id: 32402, weight: 100 },
  { id: 32403, weight: 100 },
  { id: 32404, weight: 100 },
];

export class LifeEngine {
  private readonly random: Random;
  private readonly eventMap: Map<number, GameEvent>;
  private readonly talentMap: Map<number, Talent>;
  private state: GameState | null = null;

  constructor(
    private readonly content: GameContent,
    seed = Date.now(),
  ) {
    this.random = new Random(seed);
    this.eventMap = getEventMap(content);
    this.talentMap = getTalentMap(content);
  }

  start(selectedTalentIds: number[], allocation: Allocation): GameState {
    const selectionError = validateTalentSelection(selectedTalentIds, this.content);
    if (selectionError) throw new Error(selectionError);
    if (Object.values(allocation).some(value => value < 0)) throw new Error('属性点不能为负数');
    if (allocation.INT + allocation.STR + allocation.MNY + allocation.SPR !== 20) {
      throw new Error('属性点总和必须为 20');
    }

    const props = createInitialProps();
    props.INT = allocation.INT;
    props.STR = allocation.STR;
    props.MNY = allocation.MNY;
    props.SPR = allocation.SPR;

    const state: GameState = {
      props,
      subjectTrack: null,
      selectedTalentIds,
      triggeredTalentIds: [],
      eventIds: [],
      currentAttemptEventIds: [],
      endingIds: [],
      logs: [],
      stepIndex: 0,
      currentRound: null,
      finalEnding: null,
      admissionResult: null,
      retakeUsed: false,
      retakeFrom: null,
      attempt: 1,
      isFinished: false,
    };

    for (const id of selectedTalentIds) {
      const talent = this.talentMap.get(id);
      if (talent && !talent.condition) this.applyTalent(state, talent);
    }
    refreshScore(state.props, 'preschool');
    this.state = state;
    return this.snapshot();
  }

  next(): StepResult {
    const state = this.requireState();
    if (state.isFinished) throw new Error('本局已经结束');

    const ageRound = this.content.ages[state.stepIndex];
    if (!ageRound) throw new Error('年龄回合表已经走完');

    state.currentRound = ageRound;
    state.props.AGE = ageRound.age;

    const triggeredTalents = this.triggerRoundTalents(state, ageRound);
    let earlyEnding = pickEarlyRecommendedEnding(this.content, state);
    if (earlyEnding) {
      const event = this.pickRecommendedEndingEvent(state);
      this.applyEvent(state, event, ageRound);
      refreshScore(state.props, scorePhaseForRound(state, ageRound));
      state.stepIndex += 1;
      const log = createRunLog(state, ageRound, event, [], triggeredTalents);
      state.logs.push(log);

      const admission = resolveRecommendedAdmission(this.content, state, earlyEnding, this.random);
      applyFinalResult(state, earlyEnding, admission);
      return { state: this.snapshot(), log, ending: earlyEnding, admission };
    }

    const eventRound = eventRoundForState(state, ageRound);
    const event = pickEventForRound(eventRound, this.eventMap, state, this.random);
    this.applyEvent(state, event, ageRound);
    const branchEvents = this.resolveBranches(state, event, ageRound);
    const subjectTrackEvent = this.resolveSubjectTrackForRound(state, ageRound);
    if (subjectTrackEvent) branchEvents.push(subjectTrackEvent);
    refreshScore(state.props, scorePhaseForRound(state, ageRound));

    earlyEnding = pickEarlyRecommendedEnding(this.content, state);
    const displayedEvent = earlyEnding ? this.pickRecommendedEndingEvent(state) : event;
    const displayedBranchEvents = earlyEnding ? [event, ...branchEvents] : branchEvents;
    if (earlyEnding) {
      this.applyEvent(state, displayedEvent, ageRound);
      refreshScore(state.props, scorePhaseForRound(state, ageRound));
    }

    state.stepIndex += 1;
    const log = createRunLog(state, ageRound, displayedEvent, displayedBranchEvents, triggeredTalents);
    state.logs.push(log);

    let ending: Ending | null = null;
    let admission: AdmissionResult | null = null;
    if (earlyEnding) {
      admission = resolveRecommendedAdmission(this.content, state, earlyEnding, this.random);
      ending = earlyEnding;
      applyFinalResult(state, ending, admission);
    } else if (isFinalRound(ageRound)) {
      const exam = applyRetakeExamCalibration(calculateExamScore(state.props, this.random), state);
      admission = resolveAdmission(this.content, state, exam, this.random);
      ending = pickEnding(this.content, state, admission);
      applyFinalResult(state, ending, admission);
    }

    return { state: this.snapshot(), log, ending, admission };
  }

  retake(): GameState {
    const state = this.requireState();
    if (!state.isFinished || !state.finalEnding || !state.admissionResult) {
      throw new Error('只有结局结算后才能选择复读');
    }
    if (state.retakeUsed) throw new Error('本局已经复读过一次');
    if (state.admissionResult.scoreHidden) throw new Error('保送录取已提前锁定，不能复读');

    const senior3StartIndex = this.content.ages.findIndex(item => item.age === 17 && item.round === 1);
    if (senior3StartIndex < 0) throw new Error('缺少高三起始回合');

    state.retakeFrom = {
      endingId: state.finalEnding.id,
      endingName: state.finalEnding.name,
      finalScore: state.admissionResult.finalScore,
      admissionTier: state.admissionResult.admissionTier,
      admittedUniversityCode: state.admissionResult.admittedUniversity?.code,
      admittedUniversityName: state.admissionResult.admittedUniversity?.name,
      margin: state.admissionResult.margin,
      canReach985: state.admissionResult.canReach985,
      canReach211: state.admissionResult.canReach211,
      props: { ...state.props },
    };
    state.retakeUsed = true;
    state.attempt = 2;
    state.isFinished = false;
    state.finalEnding = null;
    state.admissionResult = null;
    state.endingIds = [];
    state.currentAttemptEventIds = [];
    state.stepIndex = senior3StartIndex;
    state.currentRound = { ...this.content.ages[senior3StartIndex] };
    state.props.AGE = 17;
    state.props.SUM = 0;
    applyPropDelta(state.props, 'SPR', -1);
    applyPropDelta(state.props, 'RSK', 4);
    applyPropDelta(state.props, 'SCOREMOD', 32);
    refreshScore(state.props, 'final');

    return this.snapshot();
  }

  runToEnd(): FinalResult {
    let ending = this.requireState().finalEnding;
    let admission = this.requireState().admissionResult;
    while (!this.requireState().isFinished) {
      const step = this.next();
      ending = step.ending;
      admission = step.admission;
    }
    if (!ending) throw new Error('结局结算失败');
    if (!admission) throw new Error('录取结算失败');
    return { state: this.snapshot(), ending, admission };
  }

  getState(): GameState {
    return this.snapshot();
  }

  private triggerRoundTalents(state: GameState, ageRound: AgeRound): Talent[] {
    const triggered: Talent[] = [];
    for (const id of state.selectedTalentIds) {
      if (state.triggeredTalentIds.includes(id)) continue;
      const talent = this.talentMap.get(id);
      if (!talent?.condition) continue;
      if (ageRound.talentPool.length > 0 && !ageRound.talentPool.includes(id)) continue;
      if (!evaluateCondition(talent.condition, createConditionContext(state))) continue;
      this.applyTalent(state, talent);
      triggered.push(talent);
    }
    return triggered;
  }

  private applyTalent(state: GameState, talent: Talent): void {
    this.applyEffect(state.props, talent.effect);
    if (!state.triggeredTalentIds.includes(talent.id)) state.triggeredTalentIds.push(talent.id);
  }

  private applyEvent(state: GameState, event: GameEvent, ageRound: AgeRound): void {
    this.applyEffect(state.props, event.effect, (prop, delta, current) => scaledEventDelta(prop, delta, current, ageRound.phase));
    if (!state.eventIds.includes(event.id)) state.eventIds.push(event.id);
    if (!state.currentAttemptEventIds.includes(event.id)) state.currentAttemptEventIds.push(event.id);
  }

  private resolveBranches(state: GameState, event: GameEvent, ageRound: AgeRound): GameEvent[] {
    const branchEvents: GameEvent[] = [];
    for (const branch of event.branch ?? []) {
      if (!evaluateCondition(branch.condition, createConditionContext(state))) continue;
      const nextEvent = this.eventMap.get(branch.next);
      if (!nextEvent || !isEventAvailable(nextEvent, state)) continue;
      this.applyEvent(state, nextEvent, ageRound);
      branchEvents.push(nextEvent);
    }
    return branchEvents;
  }

  private resolveSubjectTrackForRound(state: GameState, ageRound: AgeRound): GameEvent | null {
    if (state.subjectTrack || ageRound.age !== 15 || ageRound.round !== 2) return null;

    const forcedTrack = forcedSubjectTrackFromTalents(state);
    const track = resolveSubjectTrack(state, this.random);
    state.subjectTrack = track;

    const eventId = forcedTrack === 'physics'
      ? subjectTrackEventIds.forcedPhysics
      : forcedTrack === 'history'
        ? subjectTrackEventIds.forcedHistory
        : track === 'physics'
          ? subjectTrackEventIds.physics
          : subjectTrackEventIds.history;
    const event = this.eventMap.get(eventId);
    if (!event) throw new Error(`缺少分科事件 ${eventId}`);
    this.applyEvent(state, event, ageRound);
    return event;
  }

  private pickRecommendedEndingEvent(state: GameState): GameEvent {
    const picked = pickWeighted(
      recommendedEndingEventPool
        .map(ref => ({ ref, event: this.eventMap.get(ref.id) }))
        .filter((item): item is { ref: WeightedRef; event: GameEvent } => Boolean(item.event))
        .filter(({ event }) => isEventAvailable(event, state)),
      item => item.ref.weight,
      this.random,
    );
    if (!picked) throw new Error('缺少可用的保送结局事件');
    return picked.event;
  }

  private applyEffect(
    props: Props,
    effect: Effect = {},
    scaleDelta: (prop: CorePropCode, delta: number, current: number) => number = (_prop, delta) => delta,
  ): void {
    for (const [prop, delta] of Object.entries(effect)) {
      const propCode = prop as CorePropCode;
      applyPropDelta(props, propCode, scaleDelta(propCode, delta ?? 0, props[propCode] ?? 0));
    }
  }

  private requireState(): GameState {
    if (!this.state) throw new Error('请先调用 start()');
    return this.state;
  }

  private snapshot(): GameState {
    const state = this.requireState();
    return {
      ...state,
      props: { ...state.props },
      subjectTrack: state.subjectTrack,
      selectedTalentIds: [...state.selectedTalentIds],
      triggeredTalentIds: [...state.triggeredTalentIds],
      eventIds: [...state.eventIds],
      currentAttemptEventIds: [...state.currentAttemptEventIds],
      endingIds: [...state.endingIds],
      logs: state.logs.map(log => ({ ...log, props: { ...log.props } })),
      currentRound: state.currentRound ? { ...state.currentRound } : null,
      finalEnding: state.finalEnding ? { ...state.finalEnding } : null,
      admissionResult: state.admissionResult ? { ...state.admissionResult } : null,
      retakeFrom: state.retakeFrom ? { ...state.retakeFrom, props: { ...state.retakeFrom.props } } : null,
    };
  }
}

function scaledEventDelta(prop: CorePropCode, delta: number, current: number, phase: AgeRound['phase']): number {
  const positiveScale = phase === 'senior3' ? senior3PositiveEventEffectScale : positiveEventEffectScale;
  const negativeScale = phase === 'senior3' ? senior3NegativeEventEffectScale : negativeEventEffectScale;
  const scale = delta >= 0 ? positiveScale[prop] ?? 1 : negativeScale[prop] ?? 1;
  return delta * scale * positiveEventSoftCap(prop, delta, current);
}

function positiveEventSoftCap(prop: CorePropCode, delta: number, current: number): number {
  if (delta <= 0) return 1;
  if (prop !== 'INT' && prop !== 'STR') return 1;
  if (current >= 9) return 0.45;
  if (current >= 8) return 0.65;
  if (current >= 7) return 0.85;
  return 1;
}

function isFinalRound(ageRound: AgeRound): boolean {
  return ageRound.age === 18 && ageRound.round === 4;
}

function createRunLog(
  state: GameState,
  ageRound: AgeRound,
  event: GameEvent,
  branchEvents: GameEvent[],
  triggeredTalents: Talent[],
): RunLog {
  return {
    step: ageRound.step,
    age: ageRound.age,
    round: ageRound.round,
    roundName: ageRound.roundName,
    phaseName: ageRound.phaseName,
    event,
    branchEvents,
    triggeredTalents,
    props: { ...state.props },
  };
}

function pickEarlyRecommendedEnding(content: GameContent, state: GameState): Ending | null {
  const eventScope = state.retakeUsed ? 'currentAttempt' : 'all';
  return [...content.endings]
    .filter(ending => ending.tags?.includes('保送'))
    .sort((a, b) => earlyEndingPriority(b) - earlyEndingPriority(a))
    .find(ending => evaluateCondition(
      ending.condition,
      createConditionContext(state, {}, null, { eventScope, candidateEndingId: ending.id }),
    )) ?? null;
}

function applyFinalResult(state: GameState, ending: Ending, admission: AdmissionResult): void {
  state.finalEnding = ending;
  state.admissionResult = admission;
  state.endingIds = [ending.id];
  state.props.SUM = calculateSummaryScore(state.props, ending.scoreBonus);
  state.isFinished = true;
}

function earlyEndingPriority(ending: Ending): number {
  return ending.priority - (ending.tier === 'X' ? 12 : 0);
}

function scorePhaseForRound(state: GameState, ageRound: AgeRound): AgeRound['phase'] {
  if (state.attempt === 2 && ageRound.phase === 'senior3') return 'final';
  return ageRound.phase;
}

function eventRoundForState(state: GameState, ageRound: AgeRound): AgeRound {
  if (state.attempt !== 2) return ageRound;
  const retakePool = ageRound.phase === 'senior3'
    ? retakeSenior3EventPool
    : ageRound.age === 18 && ageRound.round === 3
      ? retakeVolunteerEventPool
      : [];
  if (retakePool.length === 0) return ageRound;
  return { ...ageRound, eventPool: [...retakePool, ...ageRound.eventPool] };
}

function applyRetakeExamCalibration(exam: ExamScoreResult, state: GameState): ExamScoreResult {
  const previousScore = state.retakeFrom?.finalScore;
  if (!previousScore) return exam;

  const gap = previousScore - exam.finalScore;
  if (gap < 0 || gap > 6) return exam;

  const bonus = gap + 1;
  return {
    ...exam,
    finalScore: Math.min(750, exam.finalScore + bonus),
    variance: exam.variance + bonus,
    explanation: `${exam.explanation} 复读临场校准 +${bonus}。`,
  };
}
