import type {
  AgeRound,
  Allocation,
  CorePropCode,
  Effect,
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
import { calculateExamScore, resolveAdmission } from './admission';
import { evaluateCondition } from './condition';
import { pickEnding } from './endings';
import { createConditionContext, getEventMap, isEventAvailable, pickEventForRound } from './events';
import { applyPropDelta, calculateSummaryScore, createInitialProps, refreshScore } from './properties';
import { Random } from './random';
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
    const eventRound = eventRoundForState(state, ageRound);
    const event = pickEventForRound(eventRound, this.eventMap, state, this.random);
    this.applyEvent(state, event, ageRound);
    const branchEvents = this.resolveBranches(state, event, ageRound);
    const subjectTrackEvent = this.resolveSubjectTrackForRound(state, ageRound);
    if (subjectTrackEvent) branchEvents.push(subjectTrackEvent);
    refreshScore(state.props, scorePhaseForRound(state, ageRound));

    state.stepIndex += 1;

    const log: RunLog = {
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
    state.logs.push(log);

    let ending = null;
    let admission = null;
    if (isFinalRound(ageRound)) {
      const exam = calculateExamScore(state.props, this.random);
      admission = resolveAdmission(this.content, state, exam, this.random);
      ending = pickEnding(this.content, state, admission);
      state.finalEnding = ending;
      state.admissionResult = admission;
      state.endingIds = [ending.id];
      state.props.SUM = calculateSummaryScore(state.props, ending.scoreBonus);
      state.isFinished = true;
    }

    return { state: this.snapshot(), log, ending, admission };
  }

  retake(): GameState {
    const state = this.requireState();
    if (!state.isFinished || !state.finalEnding || !state.admissionResult) {
      throw new Error('只有结局结算后才能选择复读');
    }
    if (state.retakeUsed) throw new Error('本局已经复读过一次');

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
    applyPropDelta(state.props, 'RSK', 6);
    applyPropDelta(state.props, 'SCOREMOD', 24);
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
