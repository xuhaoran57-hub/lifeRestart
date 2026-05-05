import type { AdmissionResult, AgeRound, GameContent, GameEvent, GameState, WeightedRef } from '../app/types';
import { evaluateCondition, type ConditionContext } from './condition';
import { pickWeighted, Random } from './random';

export function getEventMap(content: GameContent): Map<number, GameEvent> {
  return new Map(content.events.map(item => [item.id, item]));
}

export function createConditionContext(
  state: GameState,
  extraProps: Record<string, number> = {},
  admission: AdmissionResult | null = null,
): ConditionContext {
  return {
    props: { ...state.props, ...extraProps },
    talentIds: new Set([...state.selectedTalentIds, ...state.triggeredTalentIds]),
    eventIds: new Set(state.eventIds),
    endingIds: new Set(state.endingIds),
    admission,
  };
}

export function isEventAvailable(event: GameEvent, state: GameState): boolean {
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
  const picked = pickWeighted(pool, item => item.ref.weight || item.event.weight || 1, random);
  if (!picked) {
    throw new Error(`No event available for age ${ageRound.age} round ${ageRound.round}`);
  }
  return picked.event;
}
