import type { AdmissionResult, Ending, GameContent, GameState } from '../app/types';
import { evaluateCondition } from './condition';
import { createConditionContext } from './events';

export function pickEnding(content: GameContent, state: GameState, admission: AdmissionResult | null = null): Ending {
  const eventScope = state.retakeUsed ? 'currentAttempt' : 'all';
  const matched = [...content.endings]
    .sort((a, b) => effectivePriority(b) - effectivePriority(a))
    .filter(item => evaluateCondition(
      item.condition,
      createConditionContext(state, {}, admission, { eventScope, candidateEndingId: item.id }),
    ));

  const ending = state.retakeFrom && matched.length > 1 && matched[0]?.id === state.retakeFrom.endingId
    ? matched[1]
    : matched[0];

  if (ending) return ending;

  const fallbackId = state.props.HSCR >= 520 ? 41111 : 41007;
  const fallback = content.endings.find(item => item.id === fallbackId);
  if (!fallback) throw new Error(`Missing fallback ending ${fallbackId}`);
  return fallback;
}

function effectivePriority(ending: Ending): number {
  return ending.priority - (ending.tier === 'X' ? 12 : 0);
}
