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
} from '../app/types';
import { calculateExamScore, resolveAdmission } from './admission';
import { evaluateCondition } from './condition';
import { pickEnding } from './endings';
import { createConditionContext, getEventMap, isEventAvailable, pickEventForRound } from './events';
import { applyPropDelta, calculateSummaryScore, createInitialProps, refreshScore } from './properties';
import { Random } from './random';
import { forcedSubjectTrackFromTalents, resolveSubjectTrack } from './subjectTrack';
import { getTalentMap, validateTalentSelection } from './talents';

const eventEffectScale: Partial<Record<CorePropCode, number>> = {
  INT: 0.42,
  STR: 0.42,
  MNY: 0.5,
  SPR: 0.4,
  VOL: 0.5,
  RSK: 0.35,
  SCOREMOD: 0.65,
};

const subjectTrackEventIds = {
  forcedPhysics: 32001,
  forcedHistory: 32002,
  physics: 32003,
  history: 32004,
} as const;

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
      endingIds: [],
      logs: [],
      stepIndex: 0,
      currentRound: null,
      finalEnding: null,
      admissionResult: null,
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
    const event = pickEventForRound(ageRound, this.eventMap, state, this.random);
    this.applyEvent(state, event);
    const branchEvents = this.resolveBranches(state, event);
    const subjectTrackEvent = this.resolveSubjectTrackForRound(state, ageRound);
    if (subjectTrackEvent) branchEvents.push(subjectTrackEvent);
    refreshScore(state.props, ageRound.phase);

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
    if (ageRound.age === 18 && ageRound.round === 4) {
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

  private applyEvent(state: GameState, event: GameEvent): void {
    this.applyEffect(state.props, event.effect, prop => eventEffectScale[prop] ?? 1);
    if (!state.eventIds.includes(event.id)) state.eventIds.push(event.id);
  }

  private resolveBranches(state: GameState, event: GameEvent): GameEvent[] {
    const branchEvents: GameEvent[] = [];
    for (const branch of event.branch ?? []) {
      if (!evaluateCondition(branch.condition, createConditionContext(state))) continue;
      const nextEvent = this.eventMap.get(branch.next);
      if (!nextEvent || !isEventAvailable(nextEvent, state)) continue;
      this.applyEvent(state, nextEvent);
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
    this.applyEvent(state, event);
    return event;
  }

  private applyEffect(props: Props, effect: Effect = {}, scaleOf: (prop: CorePropCode) => number = () => 1): void {
    for (const [prop, delta] of Object.entries(effect)) {
      const propCode = prop as CorePropCode;
      applyPropDelta(props, propCode, (delta ?? 0) * scaleOf(propCode));
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
      endingIds: [...state.endingIds],
      logs: state.logs.map(log => ({ ...log, props: { ...log.props } })),
      currentRound: state.currentRound ? { ...state.currentRound } : null,
      finalEnding: state.finalEnding ? { ...state.finalEnding } : null,
      admissionResult: state.admissionResult ? { ...state.admissionResult } : null,
    };
  }
}
