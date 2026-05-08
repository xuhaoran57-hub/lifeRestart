import type { AdmissionResult, AgeRound, GameContent, GameEvent, GameState, WeightedRef } from '../app/types';
import { evaluateCondition, type ConditionContext } from './condition';
import { pickWeighted, Random } from './random';

interface ConditionContextOptions {
  eventScope?: 'all' | 'currentAttempt';
  candidateEndingId?: number;
}

export function getEventMap(content: GameContent): Map<number, GameEvent> {
  return new Map(content.events.map(item => [item.id, item]));
}

export function createConditionContext(
  state: GameState,
  extraProps: Record<string, number> = {},
  admission: AdmissionResult | null = null,
  options: ConditionContextOptions = {},
): ConditionContext {
  const eventIds = options.eventScope === 'currentAttempt' ? state.currentAttemptEventIds : state.eventIds;
  return {
    props: {
      ...state.props,
      ...retakeComparisonProps(state, admission, options.candidateEndingId),
      ATTEMPT: state.attempt,
      RETAKE: state.retakeUsed ? 1 : 0,
      ...extraProps,
    },
    talentIds: new Set([...state.selectedTalentIds, ...state.triggeredTalentIds]),
    eventIds: new Set(eventIds),
    endingIds: new Set(state.endingIds),
    subjectTrack: state.subjectTrack,
    admission,
  };
}

export function isEventAvailable(event: GameEvent, state: GameState): boolean {
  if (event.subjectTrack && event.subjectTrack !== state.subjectTrack) return false;
  const context = createConditionContext(state);
  return evaluateCondition(event.include, context) && (!event.exclude || !evaluateCondition(event.exclude, context));
}

export function pickEventForRound(
  ageRound: AgeRound,
  eventMap: Map<number, GameEvent>,
  state: GameState,
  random: Random,
): GameEvent {
  const candidates = ageRound.eventPool
    .map(ref => ({ ref, event: eventMap.get(ref.id) }))
    .filter((item): item is { ref: WeightedRef; event: GameEvent } => Boolean(item.event))
    .filter(({ event }) => !event.noRandom)
    .filter(({ event }) => isEventAvailable(event, state));

  const unseen = candidates.filter(({ event }) => !state.eventIds.includes(event.id));
  const pool = unseen.length > 0 ? unseen : candidates;
  const picked = pickWeighted(pool, item => eventPickWeight(item.ref, item.event, state), random);
  if (!picked) {
    throw new Error(`No event available for age ${ageRound.age} round ${ageRound.round}`);
  }
  return picked.event;
}

function eventPickWeight(ref: WeightedRef, event: GameEvent, state: GameState): number {
  const baseWeight = ref.weight || event.weight || 1;
  const intDelta = event.effect?.INT ?? 0;
  const strDelta = event.effect?.STR ?? 0;
  const hasGrowth = intDelta > 0 || strDelta > 0;
  const hasSetback = intDelta < 0 || strDelta < 0;
  let multiplier = 1;

  if (hasGrowth) {
    multiplier *= 0.8;
    if (state.props.INT >= 8 && intDelta > 0) multiplier *= 0.75;
    if (state.props.STR >= 8 && strDelta > 0) multiplier *= 0.75;
  }

  if (hasSetback) {
    multiplier *= 1.1;
    if (state.props.INT >= 7 && intDelta < 0) multiplier *= 1.05;
    if (state.props.STR >= 7 && strDelta < 0) multiplier *= 1.05;
  }

  return Math.max(1, baseWeight * multiplier);
}

function retakeComparisonProps(
  state: GameState,
  admission: AdmissionResult | null,
  candidateEndingId?: number,
): Record<string, number> {
  const previous = state.retakeFrom;
  const currentTierRank = admission ? admissionTierRank(admission.admissionTier) : -1;
  const previousTierRank = previous ? admissionTierRank(previous.admissionTier) : -1;
  const currentSchool = admission?.admittedUniversity?.code;
  const previousSchool = previous?.admittedUniversityCode;
  return {
    ADMITTED: admission?.admitted ? 1 : 0,
    TIER_RANK: currentTierRank,
    PREV_SCORE: previous?.finalScore ?? 0,
    SCORE_DELTA: previous ? (admission?.finalScore ?? state.props.SCR) - previous.finalScore : 0,
    PREV_TIER_RANK: previousTierRank,
    TIER_DELTA: previous ? currentTierRank - previousTierRank : 0,
    PREV_MARGIN: previous?.margin ?? 0,
    PREV_CAN_REACH_985: previous?.canReach985 ? 1 : 0,
    PREV_CAN_REACH_211: previous?.canReach211 ? 1 : 0,
    SAME_SCHOOL: currentSchool && previousSchool && currentSchool === previousSchool ? 1 : 0,
    SAME_ENDING: previous && candidateEndingId === previous.endingId ? 1 : 0,
  };
}

function admissionTierRank(tier: AdmissionResult['admissionTier']): number {
  return {
    slide: -1,
    retake: -1,
    college: 0,
    undergraduate: 1,
    doubleFirstClass: 2,
    '211': 3,
    '985': 4,
  }[tier];
}
